import { Component, ViewChild, ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { RegiApiService, CurationFlag } from '../services/regi-api.service';
import { ServingUnitsService } from '../services/serving-units.service';
import { AdminUser } from '../models/user.model';
import { CuratedUserFoodListing } from '../models/user-food.model';
import { ImageUploadComponent } from '../image-upload/image-upload.component';
import { DeleteFoodDialogComponent, DeleteFoodDialogData } from './delete-food-dialog.component';

// Filter mode: 'browse' keeps the per-user lookup (name/email -> users -> foods -> detail);
// the three curation flags drive the candidates grid via GET /admin/userfoods/candidates.
type FilterMode = 'browse' | CurationFlag;

interface FoodGroup {
  category: string;
  foods: { food: any; flatIndex: number }[];
  collapsed: boolean;
}

interface SimplifiedNutrient {
  label: string;
  value: number | string;
  unit: string;
}

@Component({
  selector: 'app-user-foods-admin',
  templateUrl: './user-foods-admin.component.html',
  styleUrls: ['./user-foods-admin.component.scss']
})
export class UserFoodsAdminComponent {
  @ViewChild(ImageUploadComponent) imageUploadComponent!: ImageUploadComponent;
  @ViewChild('newUnitInput') newUnitInput?: ElementRef<HTMLInputElement>;

  // User search controls
  nameSearchControl = new FormControl('');
  emailSearchControl = new FormControl('');

  // User search results
  userResults: AdminUser[] = [];
  selectedUser: AdminUser | null = null;
  isSearchingUsers = false;

  // Food display
  foods: any[] = [];
  selectedFood: any = null;
  selectedIndex = 0;
  isLoadingFoods = false;
  groupedFoods: FoodGroup[] = [];

  // Nutrient display
  displayedColumns: string[] = ['label', 'value', 'unit'];
  nutrientTableData: SimplifiedNutrient[] = [];
  showingAllNutrients = false;
  showPerServing = true;

  // Filter controls. 'browse' = per-user lookup; candidate/approved/all = candidates grid.
  filterModeControl = new FormControl<FilterMode>('browse', { nonNullable: true });

  // Candidates grid (shown when filterMode is a curation flag, not 'browse').
  candidateRows: CuratedUserFoodListing[] = [];
  candidateColumns: string[] = ['authorName', 'authorEmail', 'description', 'regiApprovedCandidate', 'regiApproved', 'createdAt', 'actions'];
  isLoadingCandidates = false;

  // Metadata form controls (mirrors Foods tab)
  shortDescriptionControl = new FormControl<string | null>(null);
  glycemicIndexControl = new FormControl<number | null>(null);
  glycemicLoadControl = new FormControl<number | null>(null);
  categoryControl = new FormControl<number | null>(null);
  regiApprovedCandidateControl = new FormControl<boolean>(false);
  // RegiApproved is toggled directly against /approve|/demote (optimistic), NOT part of the
  // Save/PATCH payload. isTogglingApproval guards the in-flight request.
  regiApprovedControl = new FormControl<boolean>(false);
  isTogglingApproval = false;
  productPurchaseLinkControl = new FormControl<string | null>(null);
  servingSizeControl = new FormControl<number | null>(null);
  servingUnitControl = new FormControl<string | null>(null);
  servingGramsPerUnitControl = new FormControl<number | null>(null);
  isSavingMetadata = false;

  // Populated from the serving-units endpoint (seed as the initial/fallback list).
  servingUnitOptions: string[] = [...ServingUnitsService.BASE_SEED];

  // Sentinel option value for "Add new…" — switches the field to free-typing.
  readonly ADD_NEW_UNIT = '__add_new_unit__';
  // True while the Serving Unit field is a free-type input rather than the dropdown.
  isAddingServingUnit = false;
  // Value to restore if the free-type entry is left blank on blur.
  private priorServingUnit: string | null = null;

  // Category options (loaded from API)
  categoryOptions: { id: number; name: string }[] = [];

  // Track original values for change detection
  private originalMetadata = {
    shortDescription: null as string | null,
    glycemicIndex: null as number | null,
    glycemicLoad: null as number | null,
    categoryId: null as number | null,
    productPurchaseLink: null as string | null,
    regiApprovedCandidate: false,
    servingSize: null as number | null,
    servingUnit: null as string | null,
    servingGramsPerUnit: null as number | null
  };

  // Predefined category display order
  private readonly CATEGORY_ORDER = [
    'Protein', 'Fat', 'Dairy', 'Vegetable', 'Carbohydrate',
    'Fruit', 'Processed', 'Beverage', 'Condiment'
  ];

  constructor(
    private apiService: RegiApiService,
    private servingUnits: ServingUnitsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.apiService.getCategories().subscribe({
      next: (cats) => {
        const list = Array.isArray(cats) ? cats : cats?.categories || [];
        this.categoryOptions = list.map((c: any) => ({ id: c.categoryId || c.id, name: c.categoryName || c.name }));
      }
    });

    // Load the serving-unit vocabulary (falls back to the base seed on failure).
    this.servingUnits.getServingUnits().subscribe(units => {
      this.servingUnitOptions = units;
      this.ensureUnitOption(this.servingUnitControl.value);
    });
  }

  // ========================================
  // SERVING UNIT COMBOBOX
  // ========================================

  // Dropdown selection changed. Picking "Add new…" swaps the field to a free-type
  // input; any real pick just becomes the value to revert to next time.
  onServingUnitSelectionChange(value: string | null): void {
    if (value === this.ADD_NEW_UNIT) {
      this.isAddingServingUnit = true;
      this.servingUnitControl.setValue(null, { emitEvent: false });
      setTimeout(() => this.newUnitInput?.nativeElement.focus());
    } else {
      this.priorServingUnit = value;
    }
  }

  // Commit a free-typed unit on blur. Blank reverts to the prior selection;
  // otherwise trim (normalize) and snap to an existing option if it only differs
  // by case, so the dropdown can display it. The server re-normalizes on save.
  commitNewServingUnit(): void {
    this.isAddingServingUnit = false;
    const typed = (this.servingUnitControl.value ?? '').trim();
    if (!typed) {
      this.servingUnitControl.setValue(this.priorServingUnit);
      return;
    }
    const existing = this.servingUnitOptions.find(u => u.toLowerCase() === typed.toLowerCase());
    const finalValue = existing ?? typed;
    if (!existing) {
      this.servingUnitOptions = [...this.servingUnitOptions, finalValue];
    }
    this.priorServingUnit = finalValue;
    this.servingUnitControl.setValue(finalValue);
  }

  // Ensure a unit is present in the dropdown options (case-insensitive), so a
  // food carrying a custom/older unit still renders as selected.
  private ensureUnitOption(unit: string | null | undefined): void {
    const trimmed = (unit ?? '').trim();
    if (!trimmed) { return; }
    if (!this.servingUnitOptions.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      this.servingUnitOptions = [...this.servingUnitOptions, trimmed];
    }
  }

  // ========================================
  // USER SEARCH
  // ========================================

  // True when a curation flag (not 'browse') is selected — the candidates grid is showing.
  get isCandidatesMode(): boolean {
    return this.filterModeControl.value !== 'browse';
  }

  applyFilters(): void {
    const name = this.nameSearchControl.value?.trim() || '';
    const email = this.emailSearchControl.value?.trim() || '';
    const mode = this.filterModeControl.value;

    if (mode !== 'browse') {
      this.loadCandidates(mode, name, email);
      return;
    }

    if (!name && !email) {
      this.snackBar.open('Enter a name or email to search, or pick a Candidates / Approved / All filter', 'Close', { duration: 3000 });
      return;
    }

    // Browse mode: search users, then the picked user's foods.
    this.candidateRows = [];
    this.isSearchingUsers = true;
    this.apiService.searchAdminUsers(name || undefined, email || undefined).subscribe({
      next: (result) => {
        this.userResults = result.users || [];
        this.isSearchingUsers = false;
        if (this.userResults.length === 0) {
          this.snackBar.open('No users found', 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        this.isSearchingUsers = false;
        const msg = err.status === 403 ? 'Admin access required' : 'Search failed';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      }
    });
  }

  private loadCandidates(flag: CurationFlag, name: string, email: string): void {
    // Clear the browse-mode surface so the two views never render at once.
    this.isLoadingCandidates = true;
    this.selectedUser = null;
    this.userResults = [];
    this.foods = [];
    this.groupedFoods = [];
    this.selectedFood = null;

    this.apiService.getCuratedUserFoods(name || undefined, email || undefined, flag).subscribe({
      next: (result) => {
        this.candidateRows = result.foods || [];
        this.isLoadingCandidates = false;
        this.snackBar.open(`${this.candidateRows.length} results`, 'Close', {
          duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'
        });
      },
      error: (err) => {
        this.isLoadingCandidates = false;
        this.candidateRows = [];
        const msg = err.status === 403 ? 'Admin access required' : 'Failed to load candidates';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      }
    });
  }

  selectUser(user: AdminUser): void {
    this.selectedUser = user;
    this.loadUserFoods(user.id);
  }

  private loadUserFoods(userId: number): void {
    this.isLoadingFoods = true;
    this.foods = [];
    this.selectedFood = null;
    this.groupedFoods = [];

    this.apiService.getAdminUserFoods(userId).subscribe({
      next: (result) => {
        this.foods = result.foods || [];
        this.buildGroupedFoods();
        this.isLoadingFoods = false;

        this.snackBar.open(`${this.foods.length} foods loaded`, 'Close', {
          duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'
        });

        if (this.foods.length > 0) {
          this.selectedIndex = 0;
          this.selectedFood = this.foods[0];
          this.populateMetadataFields(this.selectedFood);
          this.updateNutrientTableData();
        }
      },
      error: () => {
        this.isLoadingFoods = false;
        this.snackBar.open('Failed to load user foods', 'Close', { duration: 5000 });
      }
    });
  }

  // ========================================
  // FOOD LIST GROUPING
  // ========================================

  private buildGroupedFoods(): void {
    const groupMap = new Map<string, { food: any; flatIndex: number }[]>();

    for (const cat of this.CATEGORY_ORDER) {
      groupMap.set(cat, []);
    }

    this.foods.forEach((food, index) => {
      const category = food.categoryName || 'Uncategorized';
      if (!groupMap.has(category)) {
        groupMap.set(category, []);
      }
      groupMap.get(category)!.push({ food, flatIndex: index });
    });

    const orderedCategories = [...this.CATEGORY_ORDER];
    for (const key of groupMap.keys()) {
      if (!orderedCategories.includes(key)) {
        orderedCategories.push(key);
      }
    }

    this.groupedFoods = orderedCategories
      .filter(cat => groupMap.has(cat))
      .map(category => ({
        category,
        foods: groupMap.get(category)!,
        collapsed: false
      }));
  }

  toggleCategoryCollapse(group: FoodGroup): void {
    group.collapsed = !group.collapsed;
  }

  // ========================================
  // FOOD SELECTION & METADATA
  // ========================================

  onFoodSelected(index: number): void {
    if (index >= 0 && index < this.foods.length) {
      this.selectedIndex = index;
      this.selectedFood = this.foods[index];
      this.populateMetadataFields(this.selectedFood);
      this.updateNutrientTableData();
    }
  }

  private populateMetadataFields(food: any): void {
    this.shortDescriptionControl.setValue(food.shortDescription ?? null);
    this.glycemicIndexControl.setValue(food.glycemicIndex ?? null);
    this.glycemicLoadControl.setValue(food.glycemicLoad ?? null);
    this.categoryControl.setValue(food.categoryId ?? null);
    this.productPurchaseLinkControl.setValue(food.productPurchaseLink ?? null);
    this.regiApprovedCandidateControl.setValue(food.regiApprovedCandidate ?? false);
    // RegiApproved toggle reflects the row; setValue silently so it doesn't fire approve/demote.
    this.regiApprovedControl.setValue(food.regiApproved ?? false, { emitEvent: false });
    this.servingSizeControl.setValue(food.servingSize ?? null);
    this.servingUnitControl.setValue(food.servingUnit ?? null);
    this.isAddingServingUnit = false;
    this.priorServingUnit = food.servingUnit ?? null;
    this.ensureUnitOption(food.servingUnit);
    this.servingGramsPerUnitControl.setValue(food.servingGramsPerUnit ?? null);

    this.originalMetadata = {
      shortDescription: food.shortDescription ?? null,
      glycemicIndex: food.glycemicIndex ?? null,
      glycemicLoad: food.glycemicLoad ?? null,
      categoryId: food.categoryId ?? null,
      productPurchaseLink: food.productPurchaseLink ?? null,
      regiApprovedCandidate: food.regiApprovedCandidate ?? false,
      servingSize: food.servingSize ?? null,
      servingUnit: food.servingUnit ?? null,
      servingGramsPerUnit: food.servingGramsPerUnit ?? null
    };
  }

  openPurchaseLink(): void {
    const url = this.productPurchaseLinkControl.value;
    if (url) {
      const fullUrl = url.startsWith('http') ? url : 'https://' + url;
      window.open(fullUrl, '_blank');
    }
  }

  // Detail-panel RegiApproved toggle: approve/demote the selected food directly (optimistic,
  // revert on failure). Independent of the Save/PATCH flow. Approving clears the candidate
  // flag server-side, so mirror that locally.
  onRegiApprovedToggle(): void {
    if (!this.selectedFood?.id) { return; }
    const target = this.regiApprovedControl.value ?? false;
    const prevApproved = this.selectedFood.regiApproved ?? false;
    const prevCandidate = this.selectedFood.regiApprovedCandidate ?? false;

    // Optimistic local state.
    this.selectedFood.regiApproved = target;
    if (target) {
      this.selectedFood.regiApprovedCandidate = false;
      this.regiApprovedCandidateControl.setValue(false);
      this.originalMetadata.regiApprovedCandidate = false;
    }
    this.isTogglingApproval = true;

    const call = target
      ? this.apiService.approveUserFood(this.selectedFood.id)
      : this.apiService.demoteUserFood(this.selectedFood.id);

    call.subscribe({
      next: () => {
        this.isTogglingApproval = false;
        this.snackBar.open(target ? 'RegiApproved' : 'Demoted', 'Close', { duration: 2000 });
      },
      error: () => {
        this.isTogglingApproval = false;
        // Revert local + control state (silently, so the revert doesn't re-fire this handler).
        this.selectedFood.regiApproved = prevApproved;
        this.selectedFood.regiApprovedCandidate = prevCandidate;
        this.regiApprovedControl.setValue(prevApproved, { emitEvent: false });
        this.regiApprovedCandidateControl.setValue(prevCandidate);
        this.originalMetadata.regiApprovedCandidate = prevCandidate;
        this.snackBar.open('Failed to update RegiApproved', 'Close', { duration: 5000 });
      }
    });
  }

  // Candidates-grid RegiApproved toggle: same approve/demote flow, per row (optimistic).
  onCandidateApprovedToggle(row: CuratedUserFoodListing, checked: boolean): void {
    const prevApproved = row.regiApproved;
    const prevCandidate = row.regiApprovedCandidate;

    row.regiApproved = checked;
    if (checked) { row.regiApprovedCandidate = false; }

    const call = checked
      ? this.apiService.approveUserFood(row.foodId)
      : this.apiService.demoteUserFood(row.foodId);

    call.subscribe({
      next: () => this.snackBar.open(checked ? 'RegiApproved' : 'Demoted', 'Close', { duration: 2000 }),
      error: () => {
        row.regiApproved = prevApproved;
        row.regiApprovedCandidate = prevCandidate;
        this.snackBar.open('Failed to update RegiApproved', 'Close', { duration: 5000 });
      }
    });
  }

  // Delete with usage check — opens the confirm dialog (which fetches /usages and runs the
  // DELETE, handling a 409 race inline). Removes the row from whichever view it lives in.
  deleteCandidate(row: CuratedUserFoodListing): void {
    this.openDeleteDialog({ foodId: row.foodId, description: row.description }, () => {
      this.candidateRows = this.candidateRows.filter(r => r.foodId !== row.foodId);
    });
  }

  deleteSelectedFood(food: any): void {
    if (!food?.id) { return; }
    this.openDeleteDialog({ foodId: food.id, description: food.description ?? '' }, () => {
      const wasSelected = this.selectedFood?.id === food.id;
      this.foods = this.foods.filter(f => f.id !== food.id);
      this.buildGroupedFoods();
      if (wasSelected) {
        this.selectedFood = this.foods.length ? this.foods[0] : null;
        this.selectedIndex = 0;
        if (this.selectedFood) {
          this.populateMetadataFields(this.selectedFood);
          this.updateNutrientTableData();
        }
      }
    });
  }

  private openDeleteDialog(data: DeleteFoodDialogData, onDeleted: () => void): void {
    this.dialog.open(DeleteFoodDialogComponent, { data, width: '360px', autoFocus: false })
      .afterClosed().subscribe(deleted => {
        if (deleted) {
          onDeleted();
          this.snackBar.open('Deleted', 'Close', { duration: 2000 });
        }
      });
  }

  hasMetadataChanges(): boolean {
    return this.shortDescriptionControl.value !== this.originalMetadata.shortDescription ||
           this.glycemicIndexControl.value !== this.originalMetadata.glycemicIndex ||
           this.glycemicLoadControl.value !== this.originalMetadata.glycemicLoad ||
           this.categoryControl.value !== this.originalMetadata.categoryId ||
           this.productPurchaseLinkControl.value !== this.originalMetadata.productPurchaseLink ||
           this.regiApprovedCandidateControl.value !== this.originalMetadata.regiApprovedCandidate ||
           this.servingSizeControl.value !== this.originalMetadata.servingSize ||
           this.servingUnitControl.value !== this.originalMetadata.servingUnit ||
           this.servingGramsPerUnitControl.value !== this.originalMetadata.servingGramsPerUnit;
  }

  async saveMetadata(): Promise<void> {
    if (!this.selectedFood?.id) {
      this.snackBar.open('No food selected', 'Close', { duration: 3000 });
      return;
    }

    const hasImages = this.imageUploadComponent?.hasFilesToUpload;

    // Build update payload — only changed fields
    const update: any = {};
    if (this.shortDescriptionControl.value !== this.originalMetadata.shortDescription) {
      update.shortDescription = this.shortDescriptionControl.value === '' ? null : this.shortDescriptionControl.value;
    }
    if (this.glycemicIndexControl.value !== this.originalMetadata.glycemicIndex) {
      update.glycemicIndex = this.glycemicIndexControl.value;
    }
    if (this.glycemicLoadControl.value !== this.originalMetadata.glycemicLoad) {
      update.glycemicLoad = this.glycemicLoadControl.value;
    }
    if (this.servingSizeControl.value !== this.originalMetadata.servingSize) {
      update.servingSize = this.servingSizeControl.value;
    }
    if (this.servingUnitControl.value !== this.originalMetadata.servingUnit) {
      update.servingUnit = this.servingUnitControl.value === '' ? null : this.servingUnitControl.value;
    }
    if (this.servingGramsPerUnitControl.value !== this.originalMetadata.servingGramsPerUnit) {
      update.servingGramsPerUnit = this.servingGramsPerUnitControl.value;
    }

    if (this.categoryControl.value !== this.originalMetadata.categoryId) {
      update.categoryId = this.categoryControl.value;
    }
    if (this.productPurchaseLinkControl.value !== this.originalMetadata.productPurchaseLink) {
      update.productPurchaseLink = this.productPurchaseLinkControl.value === '' ? null : this.productPurchaseLinkControl.value;
    }
    if (this.regiApprovedCandidateControl.value !== this.originalMetadata.regiApprovedCandidate) {
      update.regiApprovedCandidate = this.regiApprovedCandidateControl.value;
    }

    const hasMetadataChanges = Object.keys(update).length > 0;

    if (!hasMetadataChanges && !hasImages) {
      this.snackBar.open('No changes to save', 'Close', { duration: 3000 });
      return;
    }

    this.isSavingMetadata = true;

    try {
      // Step 1: Update metadata if changed. (RegiApproved is handled outside Save, via the
      // approve/demote toggle.)
      if (Object.keys(update).length > 0) {
        await this.apiService.updateAdminUserFood(this.selectedFood.id, update).toPromise();
        if ('regiApprovedCandidate' in update) {
          this.selectedFood.regiApprovedCandidate = this.regiApprovedCandidateControl.value;
        }
      }

      // Step 2: Upload images if staged
      if (hasImages) {
        const imageSuccess = await this.imageUploadComponent.uploadImages();
        if (!imageSuccess) {
          this.snackBar.open(
            hasMetadataChanges ? 'Metadata saved, but image upload failed' : 'Image upload failed',
            'Close', { duration: 5000 }
          );
          return;
        }
      }

      // Update original metadata to reflect saved state
      this.originalMetadata = {
        shortDescription: this.shortDescriptionControl.value,
        glycemicIndex: this.glycemicIndexControl.value,
        glycemicLoad: this.glycemicLoadControl.value,
        categoryId: this.categoryControl.value,
        productPurchaseLink: this.productPurchaseLinkControl.value,
        regiApprovedCandidate: this.regiApprovedCandidateControl.value ?? false,
        servingSize: this.servingSizeControl.value,
        servingUnit: this.servingUnitControl.value,
        servingGramsPerUnit: this.servingGramsPerUnitControl.value
      };

      this.snackBar.open('Saved successfully', 'Close', {
        duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'
      });

    } catch (error: any) {
      this.snackBar.open('Failed to save: ' + (error.message || 'Unknown error'), 'Close', { duration: 5000 });
    } finally {
      this.isSavingMetadata = false;
    }
  }

  truncateDescription(description: string | undefined | null, maxLength: number = 40): string {
    if (!description) return '';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength - 3) + '...';
  }

  onListKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const newIndex = Math.min(this.selectedIndex + 1, this.foods.length - 1);
      if (newIndex !== this.selectedIndex) this.onFoodSelected(newIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const newIndex = Math.max(this.selectedIndex - 1, 0);
      if (newIndex !== this.selectedIndex) this.onFoodSelected(newIndex);
    }
  }

  // ========================================
  // NUTRIENT DISPLAY
  // ========================================

  getNutrients(food: any): SimplifiedNutrient[] {
    if (!food?.nutritionFacts) return [];
    const nf = food.nutritionFacts;
    const nutrients: SimplifiedNutrient[] = [];

    let multiplier = 1;
    if (this.showPerServing && nf.servingSizeG && nf.servingSizeG > 0) {
      multiplier = nf.servingSizeG / 100;
    }

    // null/undefined source → '—' (unknown), never 0 (which means known-zero).
    nutrients.push({ label: 'Protein',  value: typeof nf.proteinG           === 'number' ? Math.round(nf.proteinG * multiplier * 10) / 10           : '—', unit: 'g' });
    nutrients.push({ label: 'Fat',      value: typeof nf.totalFatG          === 'number' ? Math.round(nf.totalFatG * multiplier * 10) / 10          : '—', unit: 'g' });
    nutrients.push({ label: 'Carbs',    value: typeof nf.totalCarbohydrateG === 'number' ? Math.round(nf.totalCarbohydrateG * multiplier * 10) / 10 : '—', unit: 'g' });
    nutrients.push({ label: 'Calories', value: typeof nf.calories           === 'number' ? Math.round(nf.calories * multiplier)                     : '—', unit: 'kcal' });

    return nutrients;
  }

  showAllNutrients(): void {
    this.showingAllNutrients = !this.showingAllNutrients;
  }

  toggleServingMode(): void {
    this.showPerServing = !this.showPerServing;
    this.updateNutrientTableData();
  }

  private updateNutrientTableData(): void {
    this.nutrientTableData = [...this.getNutrients(this.selectedFood)];
  }

  // null/undefined = unknown (render as '—', NOT 0).
  calculateNutrientValue(value: number | null | undefined): number | string {
    if (value == null) return '—';
    if (!this.selectedFood) return value;
    let multiplier = 1;
    if (this.showPerServing) {
      const nf = this.selectedFood.nutritionFacts;
      if (nf?.servingSizeG && nf.servingSizeG > 0) {
        multiplier = nf.servingSizeG / 100;
      }
    }
    return Math.round(value * multiplier * 10) / 10;
  }

  getDisplayUnit(): string {
    if (this.showPerServing && this.selectedFood?.nutritionFacts?.servingSizeG) {
      return `per ${Math.round(this.selectedFood.nutritionFacts.servingSizeG)}g`;
    }
    return 'per 100g';
  }

  getServingCount(): string {
    // 0g serving size is as useless as null for a real food — both mean "no
    // usable value", so fall back to '1'. Spelled out (rather than a bare
    // falsy check) so a future reader doesn't mistake it for an oversight.
    const ssG = this.selectedFood?.nutritionFacts?.servingSizeG;
    if (ssG == null || ssG === 0) return '1';
    if (this.showPerServing) return '1';
    return (100 / ssG).toFixed(1);
  }

  getServingLabel(): string {
    return this.showPerServing ? 'serving size:' : 'servings:';
  }

  // ========================================
  // IMAGE HELPERS
  // ========================================

  hasNutritionImage(): boolean {
    return !!(this.selectedFood?.nutritionFactsImage);
  }

  hasProductImage(): boolean {
    return !!(this.selectedFood?.foodImage);
  }

  nutritionImageUrl(): string | null {
    return this.selectedFood?.nutritionFactsImage || null;
  }

  productImageUrl(): string | null {
    return this.selectedFood?.foodImage || null;
  }

  get nutritionFactsStatus(): string | null {
    return this.selectedFood?.nutritionFactsStatus || null;
  }

  onImagesUploaded(event: any): void {
    console.log('Images uploaded:', event);
    // Reload the user's foods to get updated image URLs
    if (this.selectedUser) {
      this.loadUserFoods(this.selectedUser.id);
    }
  }

  onRefreshFood(): void {
    if (this.selectedUser) {
      this.loadUserFoods(this.selectedUser.id);
    }
  }
}

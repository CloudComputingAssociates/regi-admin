import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { YehApiService } from '../services/yeh-api.service';
import { Recipe } from '../models/recipe.model';

@Component({
  selector: 'app-recipes-admin',
  templateUrl: './recipes-admin.component.html',
  styleUrls: ['./recipes-admin.component.scss']
})
export class RecipesAdminComponent {
  // Filter controls
  titleSearchControl = new FormControl('');
  yehFilterControl = new FormControl<boolean>(false);

  // State
  recipes: Recipe[] = [];
  selectedRecipe: Recipe | null = null;
  isLoading = false;
  isSaving = false;

  // Detail form controls
  titleControl = new FormControl<string>('');
  isYEHControl = new FormControl<boolean>(false);
  attributionAuthorControl = new FormControl<string | null>(null);
  attributionLinkControl = new FormControl<string | null>(null);

  // Image/PDF staging
  stagedImageFile: File | null = null;
  stagedImagePreview: string | null = null;
  stagedPDFFile: File | null = null;
  stagedPDFName: string | null = null;

  // Track original values
  private originalMetadata = {
    title: '',
    isYEH: false,
    attributionAuthor: null as string | null,
    attributionLink: null as string | null
  };

  constructor(
    private apiService: YehApiService,
    private snackBar: MatSnackBar
  ) {}

  // ========================================
  // SEARCH & FILTER
  // ========================================

  applyFilters(): void {
    this.isLoading = true;
    this.selectedRecipe = null;

    const title = this.titleSearchControl.value?.trim() || undefined;
    const yeh = this.yehFilterControl.value || false;

    this.apiService.searchRecipes(title, yeh || undefined).subscribe({
      next: (result) => {
        this.recipes = result.recipes || [];
        this.isLoading = false;
        if (this.recipes.length === 0) {
          this.snackBar.open('No recipes found', 'Close', { duration: 3000 });
        }
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to search recipes', 'Close', { duration: 5000 });
      }
    });
  }

  // ========================================
  // CREATE
  // ========================================

  createNew(): void {
    this.apiService.createRecipe({ title: 'New Recipe' }).subscribe({
      next: (recipe) => {
        this.recipes.unshift(recipe);
        this.selectRecipe(recipe);
        // Focus the title field for immediate editing
        setTimeout(() => this.titleControl.setValue(''), 100);
      },
      error: () => {
        this.snackBar.open('Failed to create recipe', 'Close', { duration: 5000 });
      }
    });
  }

  // ========================================
  // SELECT & POPULATE
  // ========================================

  selectRecipe(recipe: Recipe): void {
    this.selectedRecipe = recipe;
    this.populateFields(recipe);
    this.clearStagedFiles();
  }

  private populateFields(r: Recipe): void {
    this.titleControl.setValue(r.title);
    this.isYEHControl.setValue(r.isYEH);
    this.attributionAuthorControl.setValue(r.attributionAuthor ?? null);
    this.attributionLinkControl.setValue(r.attributionLink ?? null);

    this.originalMetadata = {
      title: r.title,
      isYEH: r.isYEH,
      attributionAuthor: r.attributionAuthor ?? null,
      attributionLink: r.attributionLink ?? null
    };
  }

  hasChanges(): boolean {
    return this.titleControl.value !== this.originalMetadata.title ||
           this.isYEHControl.value !== this.originalMetadata.isYEH ||
           this.attributionAuthorControl.value !== this.originalMetadata.attributionAuthor ||
           this.attributionLinkControl.value !== this.originalMetadata.attributionLink ||
           this.stagedImageFile !== null ||
           this.stagedPDFFile !== null;
  }

  // ========================================
  // SAVE
  // ========================================

  async save(): Promise<void> {
    if (!this.selectedRecipe) return;

    const title = this.titleControl.value?.trim();
    if (!title) {
      this.snackBar.open('Title is required', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;

    try {
      // Step 1: Save metadata changes
      const update: any = {};
      if (this.titleControl.value !== this.originalMetadata.title) {
        update.title = this.titleControl.value;
      }
      if (this.isYEHControl.value !== this.originalMetadata.isYEH) {
        update.isYEH = this.isYEHControl.value;
      }
      if (this.attributionAuthorControl.value !== this.originalMetadata.attributionAuthor) {
        update.attributionAuthor = this.attributionAuthorControl.value || '';
      }
      if (this.attributionLinkControl.value !== this.originalMetadata.attributionLink) {
        update.attributionLink = this.attributionLinkControl.value || '';
      }

      if (Object.keys(update).length > 0) {
        await this.apiService.updateRecipe(this.selectedRecipe.id, update).toPromise();
      }

      // Step 2: Upload image if staged (use current title from form, not stale record)
      const currentTitle = this.titleControl.value?.trim() || this.selectedRecipe.title;
      if (this.stagedImageFile) {
        const imgResult: any = await this.apiService.uploadRecipeImage(
          this.selectedRecipe.id, currentTitle, this.stagedImageFile
        ).toPromise();
        if (imgResult?.cdn_url) {
          this.selectedRecipe.recipeImageLink = imgResult.cdn_url;
          this.selectedRecipe.recipeImageThumbnail = imgResult.thumbnail_url;
        }
      }

      // Step 3: Upload PDF if staged
      if (this.stagedPDFFile) {
        const pdfResult: any = await this.apiService.uploadRecipePDF(
          this.selectedRecipe.id, currentTitle, this.stagedPDFFile
        ).toPromise();
        if (pdfResult?.cdn_url) {
          this.selectedRecipe.recipePDFLink = pdfResult.cdn_url;
        }
      }

      // Update local state
      if (update.title) this.selectedRecipe.title = update.title;
      if (update.isYEH !== undefined) this.selectedRecipe.isYEH = update.isYEH;
      if (update.attributionAuthor !== undefined) this.selectedRecipe.attributionAuthor = update.attributionAuthor || undefined;
      if (update.attributionLink !== undefined) this.selectedRecipe.attributionLink = update.attributionLink || undefined;

      this.populateFields(this.selectedRecipe);
      this.clearStagedFiles();
      this.snackBar.open('Saved successfully', 'Close', { duration: 3000 });

    } catch (err: any) {
      this.snackBar.open('Save failed: ' + (err.message || 'Unknown error'), 'Close', { duration: 5000 });
    } finally {
      this.isSaving = false;
    }
  }

  // ========================================
  // DELETE
  // ========================================

  deleteRecipe(): void {
    if (!this.selectedRecipe) return;
    if (!confirm(`Delete "${this.selectedRecipe.title}"?`)) return;

    this.apiService.deleteRecipe(this.selectedRecipe.id).subscribe({
      next: () => {
        this.recipes = this.recipes.filter(r => r.id !== this.selectedRecipe!.id);
        this.selectedRecipe = null;
        this.snackBar.open('Recipe deleted', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete recipe', 'Close', { duration: 5000 });
      }
    });
  }

  // ========================================
  // FILE HANDLING (image + PDF)
  // ========================================

  onImageFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.stageImage(file);
  }

  onImageDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) this.stageImage(file);
  }

  onImagePaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) this.stageImage(file);
        break;
      }
    }
  }

  private stageImage(file: File): void {
    this.stagedImageFile = file;
    this.stagedImagePreview = URL.createObjectURL(file);
  }

  onPDFFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && file.type === 'application/pdf') this.stagePDF(file);
  }

  onPDFDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.name.endsWith('.pdf')) this.stagePDF(file);
  }

  private stagePDF(file: File): void {
    this.stagedPDFFile = file;
    this.stagedPDFName = file.name;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private clearStagedFiles(): void {
    this.stagedImageFile = null;
    this.stagedImagePreview = null;
    this.stagedPDFFile = null;
    this.stagedPDFName = null;
  }

  // ========================================
  // LINK HELPERS
  // ========================================

  openAttributionLink(): void {
    const url = this.attributionLinkControl.value;
    if (url) window.open(url.startsWith('http') ? url : 'https://' + url, '_blank');
  }

  openPDFLink(): void {
    const url = this.selectedRecipe?.recipePDFLink;
    if (url) window.open(url, '_blank');
  }

  truncateTitle(title: string | undefined, maxLen = 30): string {
    if (!title) return '';
    return title.length > maxLen ? title.substring(0, maxLen) + '...' : title;
  }
}

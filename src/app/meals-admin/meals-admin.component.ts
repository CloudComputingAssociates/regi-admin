import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { YehApiService } from '../services/yeh-api.service';
import { MealPlanSummary, MealPlanItem } from '../models/meal-plan.model';

@Component({
  selector: 'app-meals-admin',
  templateUrl: './meals-admin.component.html',
  styleUrls: ['./meals-admin.component.scss']
})
export class MealsAdminComponent implements OnInit {
  // Filter controls
  nameSearchControl = new FormControl('');
  communityCandidateFilterControl = new FormControl<boolean>(true);

  // State
  mealPlans: MealPlanSummary[] = [];
  selectedPlan: MealPlanSummary | null = null;
  isLoading = false;
  isSaving = false;

  // Detail form controls
  shareCandidateControl = new FormControl<boolean>(false);
  shareApprovedControl = new FormControl<boolean>(false);
  videoLinkControl = new FormControl<string | null>(null);
  recipeLinkControl = new FormControl<string | null>(null);

  // Original values for change detection
  private originalVideoLink: string | null = null;
  private originalRecipeLink: string | null = null;

  constructor(
    private apiService: YehApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadCandidates();
  }

  applyFilters(): void {
    if (this.communityCandidateFilterControl.value) {
      this.loadCandidates();
    }
  }

  loadCandidates(): void {
    this.isLoading = true;
    this.selectedPlan = null;

    const name = this.nameSearchControl.value?.trim() || undefined;
    const request = name
      ? this.apiService.searchMealPlans(name)
      : this.apiService.getMealPlanShareCandidates();

    request.subscribe({
      next: (data: any) => {
        const plans = Array.isArray(data) ? data : data?.meals ?? data?.data ?? [];
        this.mealPlans = plans;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Failed to load meal plans:', err);
        this.mealPlans = [];
        this.isLoading = false;
        this.snackBar.open('Failed to load meal plans', 'Dismiss', { duration: 3000 });
      }
    });
  }

  selectPlan(plan: MealPlanSummary): void {
    this.selectedPlan = plan;

    // Load full plan with items if needed
    this.apiService.getAdminMealPlan(plan.id).subscribe({
      next: (fullPlan: any) => {
        this.selectedPlan = { ...plan, ...fullPlan, items: fullPlan.items ?? [] };
        this.populateFormFields(this.selectedPlan!);
      },
      error: () => {
        this.populateFormFields(plan);
      }
    });
  }

  private populateFormFields(plan: MealPlanSummary): void {
    this.shareCandidateControl.setValue(plan.shareCandidate ?? false);
    this.shareApprovedControl.setValue(plan.shareApproved ?? false);
    this.videoLinkControl.setValue(plan.prepVideoLink ?? null);
    this.recipeLinkControl.setValue(plan.recipeLink ?? null);
    this.originalVideoLink = plan.prepVideoLink ?? null;
    this.originalRecipeLink = plan.recipeLink ?? null;

    // Disable media controls if already approved
    if (plan.shareApproved) {
      this.videoLinkControl.disable();
      this.recipeLinkControl.disable();
      this.shareCandidateControl.disable();
      this.shareApprovedControl.disable();
    } else {
      this.videoLinkControl.enable();
      this.recipeLinkControl.enable();
      this.shareCandidateControl.enable();
      this.shareApprovedControl.enable();
    }
  }

  onShareApprovedChange(): void {
    if (this.shareApprovedControl.value) {
      const confirmed = window.confirm(
        'If the meal is community shared, you will lose the ability to modify the picture, video link, and recipe link. Are you sure you are ready to publish this to the community?'
      );
      if (!confirmed) {
        this.shareApprovedControl.setValue(false);
        return;
      }
      this.shareCandidateControl.setValue(false);
    }
  }

  hasVideoLinkChanges(): boolean {
    return this.videoLinkControl.value !== this.originalVideoLink;
  }

  hasRecipeLinkChanges(): boolean {
    return this.recipeLinkControl.value !== this.originalRecipeLink;
  }

  get hasShareChanges(): boolean {
    if (!this.selectedPlan) return false;
    return this.shareApprovedControl.value !== this.selectedPlan.shareApproved ||
           this.shareCandidateControl.value !== this.selectedPlan.shareCandidate;
  }

  get isApproved(): boolean {
    return this.selectedPlan?.shareApproved ?? false;
  }

  openVideoLink(): void {
    const url = this.videoLinkControl.value;
    if (url) window.open(url, '_blank', 'noopener');
  }

  openRecipeLink(): void {
    const url = this.recipeLinkControl.value;
    if (url) window.open(url, '_blank', 'noopener');
  }

  async saveVideoLink(): Promise<void> {
    if (!this.selectedPlan || !this.hasVideoLinkChanges()) return;
    this.isSaving = true;
    try {
      await this.apiService.updateAdminMealPlan(this.selectedPlan.id, {
        prepVideoLink: this.videoLinkControl.value ?? ''
      }).toPromise();
      this.originalVideoLink = this.videoLinkControl.value;
      this.selectedPlan.prepVideoLink = this.videoLinkControl.value ?? undefined;
      this.snackBar.open('Video link saved', 'Dismiss', { duration: 2000 });
    } catch {
      this.snackBar.open('Failed to save video link', 'Dismiss', { duration: 3000 });
    }
    this.isSaving = false;
  }

  async saveRecipeLink(): Promise<void> {
    if (!this.selectedPlan || !this.hasRecipeLinkChanges()) return;
    this.isSaving = true;
    try {
      await this.apiService.updateAdminMealPlan(this.selectedPlan.id, {
        recipeLink: this.recipeLinkControl.value ?? ''
      }).toPromise();
      this.originalRecipeLink = this.recipeLinkControl.value;
      this.selectedPlan.recipeLink = this.recipeLinkControl.value ?? undefined;
      this.snackBar.open('Recipe link saved', 'Dismiss', { duration: 2000 });
    } catch {
      this.snackBar.open('Failed to save recipe link', 'Dismiss', { duration: 3000 });
    }
    this.isSaving = false;
  }

  async saveApproval(): Promise<void> {
    if (!this.selectedPlan || !this.hasShareChanges) return;
    this.isSaving = true;
    try {
      if (this.shareApprovedControl.value !== this.selectedPlan.shareApproved) {
        await this.apiService.setMealPlanShareApproval(
          this.selectedPlan.id,
          this.shareApprovedControl.value ?? false
        ).toPromise();
        this.selectedPlan.shareApproved = this.shareApprovedControl.value ?? false;
        if (this.shareApprovedControl.value) {
          this.selectedPlan.shareCandidate = false;
          this.shareCandidateControl.setValue(false);
          // Lock media fields after approval
          this.videoLinkControl.disable();
          this.recipeLinkControl.disable();
          this.shareCandidateControl.disable();
          this.shareApprovedControl.disable();
        }
      }
      this.snackBar.open('Approval saved', 'Dismiss', { duration: 2000 });
      // Refresh list
      this.loadCandidates();
    } catch {
      this.snackBar.open('Failed to save approval', 'Dismiss', { duration: 3000 });
    }
    this.isSaving = false;
  }

  truncateDescription(desc?: string | null, maxLen = 40): string {
    if (!desc) return '';
    return desc.length > maxLen ? desc.substring(0, maxLen) + '...' : desc;
  }
}

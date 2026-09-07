import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RegiApiService } from '../services/regi-api.service';
import { UserFoodUsage } from '../models/user-food.model';

export interface DeleteFoodDialogData {
  foodId: number;
  description: string;
}

// Delete-with-usage-check confirm. On open it fetches /usages; Delete is enabled only when
// every count is zero. Deletion runs here so a 409 race (row became referenced between the
// usage check and the delete) re-renders the counts returned in the 409 body inline.
@Component({
  selector: 'app-delete-food-dialog',
  template: `
    <h2 mat-dialog-title>Delete user food</h2>
    <mat-dialog-content>
      <p class="food-name">{{ data.description }}</p>
      <p class="food-id">Food ID {{ data.foodId }}</p>

      <div class="loading-row" *ngIf="loadingUsages">
        <mat-spinner diameter="20"></mat-spinner>
        <span>Checking usage…</span>
      </div>

      <ng-container *ngIf="!loadingUsages && usages">
        <p class="usage-heading">Referenced by:</p>
        <ul class="usage-list">
          <li>Meal items: <strong>{{ usages.mealItems }}</strong></li>
          <li>User preferences: <strong>{{ usages.preferences }}</strong></li>
        </ul>
        <p class="usage-note" *ngIf="total() > 0">
          In use — cannot delete until all references are zero.
        </p>
        <p class="usage-note ok" *ngIf="total() === 0">
          No references. Safe to delete (food + nutrition facts).
        </p>
      </ng-container>

      <p class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()" [disabled]="deleting">Cancel</button>
      <button mat-raised-button color="warn"
              (click)="confirmDelete()"
              [disabled]="loadingUsages || deleting || !usages || total() > 0">
        {{ deleting ? 'Deleting…' : 'Delete' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .food-name { font-weight: 600; margin: 0 0 4px; }
    .food-id { color: rgba(0,0,0,0.54); margin: 0 0 12px; font-size: 12px; }
    .loading-row { display: flex; align-items: center; gap: 8px; }
    .usage-heading { margin: 8px 0 4px; }
    .usage-list { margin: 0 0 8px; padding-left: 20px; }
    .usage-note { margin: 4px 0 0; color: #b00020; }
    .usage-note.ok { color: #2e7d32; }
    .error-msg { color: #b00020; margin-top: 8px; }
  `]
})
export class DeleteFoodDialogComponent {
  usages: UserFoodUsage | null = null;
  loadingUsages = true;
  deleting = false;
  errorMsg: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<DeleteFoodDialogComponent, boolean>,
    private apiService: RegiApiService,
    @Inject(MAT_DIALOG_DATA) public data: DeleteFoodDialogData
  ) {
    this.apiService.getUserFoodUsages(data.foodId).subscribe({
      next: (u) => { this.usages = u; this.loadingUsages = false; },
      error: () => {
        this.loadingUsages = false;
        this.errorMsg = 'Failed to check usage.';
      }
    });
  }

  total(): number {
    return this.usages ? this.usages.mealItems + this.usages.preferences : 0;
  }

  confirmDelete(): void {
    this.deleting = true;
    this.errorMsg = null;
    this.apiService.deleteUserFood(this.data.foodId).subscribe({
      next: () => this.dialogRef.close(true),
      error: (err) => {
        this.deleting = false;
        // 409: row became referenced between the usage check and the delete — render the
        // counts the server returned so the admin sees why it was refused.
        if (err?.status === 409 && err?.error?.usages) {
          this.usages = err.error.usages;
          this.errorMsg = 'Now in use — delete refused.';
        } else {
          this.errorMsg = 'Delete failed.';
        }
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

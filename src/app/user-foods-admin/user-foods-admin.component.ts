import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { YehApiService } from '../services/yeh-api.service';
import { AdminUser } from '../models/user.model';

interface FoodGroup {
  category: string;
  foods: { food: any; flatIndex: number }[];
  collapsed: boolean;
}

interface SimplifiedNutrient {
  label: string;
  value: number;
  unit: string;
}

@Component({
  selector: 'app-user-foods-admin',
  templateUrl: './user-foods-admin.component.html',
  styleUrls: ['./user-foods-admin.component.scss']
})
export class UserFoodsAdminComponent {
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

  // Predefined category display order
  private readonly CATEGORY_ORDER = [
    'Protein', 'Fat', 'Dairy', 'Vegetable', 'Carbohydrate',
    'Fruit', 'Processed', 'Beverage', 'Condiment'
  ];

  constructor(
    private apiService: YehApiService,
    private snackBar: MatSnackBar
  ) {}

  // ========================================
  // USER SEARCH
  // ========================================

  searchUsers(): void {
    const name = this.nameSearchControl.value?.trim() || '';
    const email = this.emailSearchControl.value?.trim() || '';

    if (!name && !email) {
      this.snackBar.open('Enter a name or email to search', 'Close', { duration: 3000 });
      return;
    }

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
  // FOOD SELECTION & DISPLAY
  // ========================================

  onFoodSelected(index: number): void {
    if (index >= 0 && index < this.foods.length) {
      this.selectedIndex = index;
      this.selectedFood = this.foods[index];
      this.updateNutrientTableData();
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

    if (typeof nf.proteinG === 'number')
      nutrients.push({ label: 'Protein', value: Math.round(nf.proteinG * multiplier * 10) / 10, unit: 'g' });
    if (typeof nf.totalFatG === 'number')
      nutrients.push({ label: 'Fat', value: Math.round(nf.totalFatG * multiplier * 10) / 10, unit: 'g' });
    if (typeof nf.totalCarbohydrateG === 'number')
      nutrients.push({ label: 'Carbs', value: Math.round(nf.totalCarbohydrateG * multiplier * 10) / 10, unit: 'g' });
    if (typeof nf.calories === 'number')
      nutrients.push({ label: 'Calories', value: Math.round(nf.calories * multiplier), unit: 'kcal' });

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

  calculateNutrientValue(value: number): number {
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
}

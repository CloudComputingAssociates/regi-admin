export interface MealPlanSummary {
  id: number;
  name: string;
  planType: string;
  totalCalories?: number;
  totalProteinG?: number;
  totalFatG?: number;
  totalCarbG?: number;
  totalFiberG?: number;
  totalSodiumMg?: number;
  mealImage?: string;
  mealImageThumbnail?: string;
  prepVideoLink?: string;
  recipeLink?: string;
  shareCandidate: boolean;
  shareApproved: boolean;
  userName?: string;
  userEmail?: string;
  items?: MealPlanItem[];
  createdAt: string;
}

export interface MealPlanItem {
  id?: number;
  foodId: number;
  foodName: string;
  shortDescription?: string;
  foodImageThumbnail?: string;
  quantity: number;
  unit: string;
  calories?: number;
  proteinG?: number;
  fatG?: number;
  carbG?: number;
  fiberG?: number;
  sodiumMg?: number;
  sortOrder?: number;
}

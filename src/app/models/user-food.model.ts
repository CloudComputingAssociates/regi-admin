// Hand-derived mirror of c:\git\regi-api\schemas\user-food.schema.json.
// The JSON Schema is authoritative — keep this in sync by re-reading the schema; never
// invent, rename, add, or drop a field the schema doesn't have.
//
// UserFood is the user-created food row. `regiApprovedCandidate` (author submission queue,
// renamed from the old `shareCandidate`) and `regiApproved` (admin curation bit) are the
// admin-surface flags. `shareApproved` is retained here to mirror the schema but is an
// internal FatSecret dedup cache — NOT an admin/UI surface.
export interface UserFood {
  id: number;                              // UserFoodID primary key
  userId: number;                          // owner user ID
  description: string;
  shortDescription?: string | null;
  servingUnit?: string | null;
  gramsPerServingUnit?: number | null;
  shareWithCommunity?: boolean;
  foodImage?: string | null;
  nutritionFactsImage?: string | null;
  servingSizeHousehold?: string | null;
  servingSizeG?: number | null;
  calories: number;
  proteinG: number;
  totalFatG: number;
  saturatedFatG?: number | null;
  transFatG?: number | null;
  cholesterolMG?: number | null;
  sodiumMG: number;
  totalCarbohydrateG: number;
  dietaryFiberG: number;
  totalSugarsG?: number | null;
  addedSugarsG?: number | null;
  vitaminDMcg?: number | null;
  calciumMG?: number | null;
  ironMG?: number | null;
  potassiumMG?: number | null;
  regiApprovedCandidate?: boolean;
  regiApproved?: boolean;
  shareApproved?: boolean;
  twistIngredient?: boolean;
  dynamicIngredient?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// One row of the admin curation grid — GET /api/admin/userfoods/candidates
// (`{ count, foods }`). Mirrors repos.CuratedUserFoodListing: the food's identity + flags
// plus the author's display name and email (joined from the regi users table).
export interface CuratedUserFoodListing {
  foodId: number;
  description: string;
  shortDescription?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  regiApproved: boolean;
  regiApprovedCandidate: boolean;
  userId: number;
  authorName?: string | null;
  authorEmail?: string | null;
  createdAt: string;
}

// Reference counts that inform an admin delete — GET /api/admin/userfoods/{id}/usages,
// and the body of a 409 from DELETE. Mirrors repos.UserFoodUsage. CurrentPicks are excluded
// by design (clearable/rebuildable JSON, not scanned).
export interface UserFoodUsage {
  mealItems: number;
  preferences: number;
}

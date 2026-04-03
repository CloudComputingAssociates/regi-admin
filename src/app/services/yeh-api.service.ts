import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Food, FoodMetadataUpdate, FatSecretCompareResponse, FatSecretOverwriteRequest } from '../models/food.model';

interface NutritionUploadResponse {
  success: boolean;
  cdn_url: string;
  description: string;
  status: string;
}

interface ProductUploadResponse {
  success: boolean;
  cdn_url: string;
  thumbnail_url: string;
  food_id: number;
}

@Injectable({
  providedIn: 'root'
})
export class YehApiService {
  private baseUrl = environment.apiUrl;

  // Image API base URL (yeh-image on port 8081)
  private imageApiUrl = environment.apiUrl.replace(':8080', ':8081').replace('/api', '');

  constructor(private http: HttpClient) { }

  // ========================================
  // FOODS API ENDPOINTS (yeh-api)
  // ========================================

  searchFoods(query: string, limit?: number): Observable<any> {
    let url = `${this.baseUrl}/foods/search?query=${encodeURIComponent(query)}`;
    if (limit !== undefined && limit !== null) {
      url += `&limit=${limit}`;
    }
    return this.http.get<any>(url);
  }

  // Get all YEH Approved foods (optionally filtered by query)
  // Uses /api/foods/search/all/yehapproved endpoint
  searchYehApprovedFoods(limit?: number): Observable<any> {
    let url = `${this.baseUrl}/foods/search/all/yehapproved`;
    if (limit !== undefined && limit !== null) {
      url += `?limit=${limit}`;
    }
    return this.http.get<any>(url);
  }

  refreshFood(query: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/foods/search?query=${encodeURIComponent(query)}`);
  }

  hasBrandLinks(food: any): boolean {
    if (!food?.brandInfo) {
      return false;
    }
    const nutritionLinks = food.brandInfo.nutritionSiteCandidates || [];
    const productLinks = food.brandInfo.productImageSiteCandidates || [];
    return nutritionLinks.length > 0 || productLinks.length > 0;
  }

  getImageUrl(objectId: string): string {
    return `${this.baseUrl}/images/${objectId}`;
  }

  // Update food metadata (ShortDescription, GlycemicIndex, GlycemicLoad)
  // Uses PATCH /api/foods/{id}
  updateFoodMetadata(foodId: number, update: FoodMetadataUpdate): Observable<Food> {
    return this.http.patch<Food>(`${this.baseUrl}/foods/${foodId}`, update);
  }

  // ========================================
  // FATSECRET COMPARE / OVERWRITE
  // ========================================

  compareFatSecret(foodId: number): Observable<FatSecretCompareResponse> {
    return this.http.get<FatSecretCompareResponse>(`${this.baseUrl}/foods/${foodId}/fatsecret-compare`);
  }

  overwriteFromFatSecret(foodId: number, req: FatSecretOverwriteRequest): Observable<Food> {
    return this.http.post<Food>(`${this.baseUrl}/foods/${foodId}/fatsecret-overwrite`, req);
  }

  // ========================================
  // IMAGE API ENDPOINTS (yeh-image)
  // ========================================

  uploadNutritionImage(
    foodId: number,
    nutritionImage: File,
    options?: {
      ingredientsImage?: File;
    }
  ): Observable<NutritionUploadResponse> {
    const formData = new FormData();
    formData.append('foodId', foodId.toString());
    formData.append('nutritionImage', nutritionImage);

    if (options?.ingredientsImage) {
      formData.append('ingredientsImage', options.ingredientsImage);
    }

    return this.http.post<NutritionUploadResponse>(
      `${this.imageApiUrl}/api/image/upload/nutrition`,
      formData
    );
  }

  uploadProductImage(foodId: number, image: File): Observable<ProductUploadResponse> {
    const formData = new FormData();
    formData.append('foodId', foodId.toString());
    formData.append('image', image);

    return this.http.post<ProductUploadResponse>(
      `${this.imageApiUrl}/api/image/upload/product`,
      formData
    );
  }

  getImageUrls(description: string, type?: 'product' | 'nutrition'): Observable<any> {
    let url = `${this.imageApiUrl}/api/image/url/?description=${encodeURIComponent(description)}`;
    if (type) {
      url += `&type=${type}`;
    }
    return this.http.get<any>(url);
  }

  getImageProcessingStatus(): Observable<any> {
    return this.http.get<any>(`${this.imageApiUrl}/api/image/status`);
  }

  getImageApiHealth(): Observable<any> {
    return this.http.get<any>(`${this.imageApiUrl}/api/image/health`);
  }

  // ========================================
  // ADMIN ENDPOINTS
  // ========================================

  searchAdminUsers(name?: string, email?: string): Observable<any> {
    let params = new HttpParams();
    if (name) params = params.set('name', name);
    if (email) params = params.set('email', email);
    return this.http.get<any>(`${this.baseUrl}/admin/users/search`, { params });
  }

  getAdminUserFoods(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/admin/userfoods/by-user/${userId}`);
  }

  // Update a user food's metadata (admin, uses existing PUT endpoint)
  updateAdminUserFood(userFoodId: number, update: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/userfoods/${userFoodId}`, update);
  }

  // Approve or reject a share candidate
  setShareApproval(userFoodId: number, approved: boolean): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/userfoods/${userFoodId}/approve`, { approved });
  }

  // Get all share candidates (ShareCandidate=1, pending review)
  getShareCandidates(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/userfoods/candidates`);
  }

  // Get food categories
  getCategories(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/foods/categories`);
  }
}

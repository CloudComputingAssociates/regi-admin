export interface Recipe {
  id: number;
  title: string;
  recipeImageLink?: string;
  recipeImageThumbnail?: string;
  recipePDFLink?: string;
  isYEH: boolean;
  attributionAuthor?: string;
  attributionLink?: string;
  createdAt: string;
  updatedAt: string;
}

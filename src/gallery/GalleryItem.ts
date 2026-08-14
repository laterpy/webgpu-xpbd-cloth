export interface GalleryStory {
  subtitle: string;
  paragraph1: string;
  paragraph2?: string;
  quote?: string;
}

export interface GalleryItemData {
  id: string;
  roomId: string;
  title: string;
  year: string;
  location: string;
  cameraInfo?: string;
  preset: string; // 'photoPaper' | 'fineArtCanvas' | 'silkFabric' | 'agedPaper'
  aspectRatio: number; // width / height
  story: GalleryStory;
  imageSrc?: string;
  isCustom?: boolean;
}

export type AppMode = 'entrance' | 'browse' | 'focus' | 'roomTravel';

export interface AppStateData {
  mode: AppMode;
  roomIndex: number;
  photoIndex: number;
  wind: number;
  gravity: number;
}

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type PacsImageUrlOptions = {
  modality?: string;
  width?: number;
  preferPreview?: boolean;
  imageSource?: string;
};

interface PacsPreviewViewerProps {
  activeImage: any;
  images: any[];
  currentIndex: number;
  totalImages: number;
  modality: string;
  loading: boolean;
  zoomLevel: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  onPrev: () => void;
  onNext: () => void;
  onGoToIndex: (index: number) => void;
  onTogglePlay: () => void;
  onPlaybackSpeedChange: (value: number) => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomIn: () => void;
  getImageUrl: (instanceId: string, options?: PacsImageUrlOptions) => string;
}

const PacsPreviewViewer: React.FC<PacsPreviewViewerProps> = ({
  activeImage,
  images,
  currentIndex,
  totalImages,
  modality,
  loading,
  zoomLevel,
  isPlaying,
  playbackSpeed,
  onWheel,
  onPrev,
  onNext,
  onGoToIndex,
  onTogglePlay,
  onPlaybackSpeedChange,
  onZoomOut,
  onResetZoom,
  onZoomIn,
  getImageUrl
}) => {
  const isCtPacsPreview = String(modality || '').toUpperCase() === 'CT';
  const totalImagesLabel = Math.max(Number(totalImages) || 0, images.length);

  if (!activeImage) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Belum ada gambar PACS yang dapat ditampilkan.
      </div>
    );
  }

  return (
    <>
      {!isCtPacsPreview ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">Kontrol Gambar PACS</p>
              <p className="text-sm text-muted-foreground">
                Gunakan zoom untuk memperbesar atau memperkecil gambar, lalu unduh bila diperlukan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onZoomOut}
                disabled={zoomLevel <= 1}
                className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                aria-label="Zoom Out"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4 sm:mr-2" />
                <span className="sr-only sm:not-sr-only">Zoom Out</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResetZoom}
                disabled={zoomLevel === 1}
                className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                aria-label="Reset"
                title="Reset"
              >
                <RotateCcw className="h-4 w-4 sm:mr-2" />
                <span className="sr-only sm:not-sr-only">Reset</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onZoomIn}
                disabled={zoomLevel >= 4}
                className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                aria-label="Zoom In"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4 sm:mr-2" />
                <span className="sr-only sm:not-sr-only">Zoom In</span>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                disabled={!activeImage?.instance_id}
                className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              >
                <a
                  href={activeImage?.instance_id
                    ? getImageUrl(activeImage.instance_id, {
                        modality,
                        width: 1800,
                        imageSource: activeImage?.image_source
                      })
                    : '#'}
                  target="_blank"
                  rel="noreferrer"
                  download={`pacs-${activeImage?.instance_id || currentIndex + 1}.jpg`}
                  aria-label="Download"
                  title="Download"
                >
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="sr-only sm:not-sr-only">Download</span>
                </a>
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Zoom: {Math.round(zoomLevel * 100)}%
          </div>
        </div>
      ) : null}

      <div className="relative rounded-lg border bg-black/5 p-4">
        <div onWheel={onWheel}>
          <div className="flex max-h-[60vh] w-full items-center justify-center overflow-auto">
            <img
              src={getImageUrl(activeImage.instance_id, {
                modality,
                width: 1800,
                preferPreview: isCtPacsPreview,
                imageSource: activeImage?.image_source
              })}
              alt={`Preview PACS ${currentIndex + 1}`}
              className="mx-auto max-h-[60vh] w-auto rounded-md object-contain transition-transform duration-200"
              style={!isCtPacsPreview ? {
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center'
              } : undefined}
            />
          </div>
        </div>

        {loading ? (
          <div className="absolute inset-x-4 top-4 rounded-md bg-background/95 px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Memuat daftar slice CT secara bertahap...
          </div>
        ) : null}

        {images.length > 1 ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/90"
              onClick={onPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/90"
              onClick={onNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        ) : null}
      </div>

      {isCtPacsPreview ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">CT Stack Player</p>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? `Modal sudah tampil. Viewer CT sedang memuat daftar slice (${images.length}/${totalImagesLabel}).`
                  : 'Klik play untuk menelusuri slice secara otomatis. Scroll mouse untuk pindah slice, `Shift + scroll` untuk lompat lebih cepat.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || images.length <= 1}
                onClick={onTogglePlay}
              >
                {isPlaying ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Play
                  </>
                )}
              </Button>
              <span className="text-sm text-muted-foreground">
                {loading ? `${images.length}/${totalImagesLabel} slice` : `${totalImagesLabel} slice`}
              </span>
              <Select
                value={String(playbackSpeed)}
                onValueChange={(value) => onPlaybackSpeedChange(Number(value))}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Kecepatan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="320">Lambat</SelectItem>
                  <SelectItem value="180">Normal</SelectItem>
                  <SelectItem value="90">Cepat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Slice 1</span>
            <span>Slice {currentIndex + 1}</span>
            <span>Slice {Math.max(images.length, totalImagesLabel)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(images.length - 1, 0)}
            step={1}
            value={currentIndex}
            onChange={(event) => onGoToIndex(Number(event.target.value))}
            className="w-full accent-primary"
          />
        </div>
      ) : null}

      {activeImage.description ? (
        <p className="text-sm text-muted-foreground">
          {activeImage.description}
        </p>
      ) : null}

      {images.length > 1 && !isCtPacsPreview ? (
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <div className="flex gap-3 p-3">
            {images.map((image: any, index: number) => (
              <button
                key={`${image.instance_id}-modal-${index}`}
                type="button"
                onClick={() => onGoToIndex(index)}
                className={cn(
                  'overflow-hidden rounded-md border bg-muted/30',
                  index === currentIndex && 'ring-2 ring-primary'
                )}
              >
                <img
                  src={getImageUrl(image.instance_id, {
                    modality,
                    width: 220,
                    preferPreview: false,
                    imageSource: image?.image_source
                  })}
                  alt={`Thumbnail PACS ${index + 1}`}
                  className="h-20 w-32 object-cover"
                />
              </button>
            ))}
          </div>
        </ScrollArea>
      ) : null}
    </>
  );
};

export default PacsPreviewViewer;

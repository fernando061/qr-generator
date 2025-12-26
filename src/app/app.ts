import { Component, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import * as QRCode from 'qrcode';

const urlValidator = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { invalidUrl: true };
    }
    return null;
  } catch {
    return { invalidUrl: true };
  }
};

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly urlControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, urlValidator]
  });
  readonly form = new FormGroup({
    url: this.urlControl
  });
  readonly isGenerating = signal(false);
  readonly qrDataUrl = signal('');
  readonly svgMarkup = signal('');
  readonly errorMessage = signal('');

  get showUrlError(): boolean {
    return this.urlControl.invalid && (this.urlControl.dirty || this.urlControl.touched);
  }

  get urlErrorText(): string {
    if (this.urlControl.hasError('required')) {
      return 'La URL es obligatoria.';
    }
    if (this.urlControl.hasError('invalidUrl')) {
      return 'Ingresa una URL valida con http:// o https://';
    }
    return 'Ingresa una URL valida.';
  }

  get isGenerateDisabled(): boolean {
    return this.isGenerating() || !this.urlControl.value || this.urlControl.invalid;
  }

  async generateQr(): Promise<void> {
    this.errorMessage.set('');
    if (this.urlControl.invalid) {
      this.urlControl.markAsTouched();
      return;
    }

    const value = this.urlControl.value.trim();
    if (!value) {
      this.urlControl.markAsTouched();
      return;
    }

    this.isGenerating.set(true);

    const options = {
      errorCorrectionLevel: 'M' as const,
      margin: 2,
      width: 320,
      color: {
        dark: '#1f1f1f',
        light: '#ffffff'
      }
    };

    try {
      const [pngDataUrl, svgMarkup] = await Promise.all([
        QRCode.toDataURL(value, options),
        QRCode.toString(value, { ...options, type: 'svg' })
      ]);
      this.qrDataUrl.set(pngDataUrl);
      this.svgMarkup.set(svgMarkup);
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo generar el QR. Intenta nuevamente.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  downloadAs(type: 'png' | 'svg'): void {
    if (type === 'png') {
      const dataUrl = this.qrDataUrl();
      if (!dataUrl) {
        return;
      }
      this.triggerDownload(dataUrl, 'qr.png');
      return;
    }

    const svgMarkup = this.svgMarkup();
    if (!svgMarkup) {
      return;
    }

    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    this.triggerDownload(blobUrl, 'qr.svg');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  }

  private triggerDownload(href: string, filename: string): void {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.rel = 'noopener';
    link.click();
  }
}

// src/app/shared/components/code-block/code-block.component.ts
import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import hljs from 'highlight.js/lib/core';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';

// Enregistré une seule fois, au chargement du module — pas de bundle
// highlight.js complet (190+ langages), uniquement ceux dont on a besoin.
if (!hljs.getLanguage('yaml')) hljs.registerLanguage('yaml', yaml);
if (!hljs.getLanguage('bash')) hljs.registerLanguage('bash', bash);

export type CodeBlockLanguage = 'yaml' | 'bash' | 'text';

@Component({
  selector: 'app-code-block',
  standalone: true,
  templateUrl: './code-block.component.html',
  styleUrl: './code-block.component.scss',
})
export class CodeBlockComponent implements OnChanges {
  @Input() code = '';
  @Input() language: CodeBlockLanguage = 'text';

  highlighted: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    // Pas de risque XSS malgré bypassSecurityTrustHtml : hljs.highlight()
    // echappe toujours le texte source (< > &) avant de l'entourer de <span
    // class="hljs-...">, il n'interprete jamais le contenu de `code` comme du
    // HTML. Le chemin 'text' passe par _escape() (textContent), donc echappe
    // aussi. bypassSecurityTrustHtml sert uniquement a preserver les classes
    // hljs-* que le sanitizer par defaut d'Angular retirerait sinon.
    const raw = this.language === 'text'
      ? this._escape(this.code)
      : hljs.highlight(this.code || '', { language: this.language }).value;
    this.highlighted = this.sanitizer.bypassSecurityTrustHtml(raw);
  }

  private _escape(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

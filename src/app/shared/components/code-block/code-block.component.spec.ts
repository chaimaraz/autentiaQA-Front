import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { CodeBlockComponent } from './code-block.component';

describe('CodeBlockComponent', () => {
  let component: CodeBlockComponent;
  let fixture: ComponentFixture<CodeBlockComponent>;
  let sanitizer: DomSanitizer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeBlockComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeBlockComponent);
    component = fixture.componentInstance;
    sanitizer = TestBed.inject(DomSanitizer);
  });

  function renderedHtml(): string | null {
    return sanitizer.sanitize(SecurityContext.HTML, component.highlighted);
  }

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('escapes HTML special characters for the "text" language', () => {
    component.code = '<div class="x">&"foo"</div>';
    component.language = 'text';
    component.ngOnChanges();

    const html = renderedHtml();
    expect(html).toContain('&lt;div');
    expect(html).not.toContain('<div class="x">');
  });

  it('produces empty output for empty text code', () => {
    component.code = '';
    component.language = 'text';
    component.ngOnChanges();

    expect(renderedHtml()).toBe('');
  });

  it('highlights yaml code without throwing and preserves the source content', () => {
    component.code = 'key: value';
    component.language = 'yaml';
    expect(() => component.ngOnChanges()).not.toThrow();

    const html = renderedHtml();
    expect(html).toContain('key');
    expect(html).toContain('value');
  });

  it('highlights bash code without throwing and preserves the source content', () => {
    component.code = 'echo "hello"';
    component.language = 'bash';
    expect(() => component.ngOnChanges()).not.toThrow();

    const html = renderedHtml();
    expect(html).toContain('echo');
  });

  it('treats a falsy code value as an empty string when highlighting a known language', () => {
    component.code = '';
    component.language = 'yaml';
    expect(() => component.ngOnChanges()).not.toThrow();
    expect(renderedHtml()).toBe('');
  });
});

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'stepName',
  standalone: true
})
export class StepNamePipe implements PipeTransform {

  transform(steps: any[]): string {

    if (!steps || steps.length === 0) {
      return 'Étape inconnue';
    }

    return steps[0]?.action || 'Étape inconnue';
  }
}

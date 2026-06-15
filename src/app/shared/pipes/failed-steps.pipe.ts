import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'failedSteps',
  standalone: true
})
export class FailedStepsPipe implements PipeTransform {

  transform(steps: any[]): any[] {

    if (!steps) {
      return [];
    }

    return steps.filter(step => step.result === 'fail');
  }
}

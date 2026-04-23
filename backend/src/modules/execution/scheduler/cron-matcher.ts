import { Injectable } from '@nestjs/common';

@Injectable()
export class CronMatcher {
  matches(expression: string, date: Date) {
    const fields = expression.trim().split(/\s+/);

    if (fields.length !== 5) {
      return false;
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

    return (
      this.matchesField(minute, date.getMinutes(), 0, 59) &&
      this.matchesField(hour, date.getHours(), 0, 23) &&
      this.matchesField(dayOfMonth, date.getDate(), 1, 31) &&
      this.matchesField(month, date.getMonth() + 1, 1, 12) &&
      this.matchesField(dayOfWeek, date.getDay(), 0, 6)
    );
  }

  isValid(expression: string) {
    const fields = expression.trim().split(/\s+/);

    if (fields.length !== 5) {
      return false;
    }

    return fields.every((field, index) => {
      const [min, max] = [
        [0, 59],
        [0, 23],
        [1, 31],
        [1, 12],
        [0, 6],
      ][index];

      return this.parseField(field, min, max).size > 0;
    });
  }

  private matchesField(field: string, value: number, min: number, max: number) {
    return this.parseField(field, min, max).has(value);
  }

  private parseField(field: string, min: number, max: number) {
    const values = new Set<number>();

    for (const segment of field.split(',')) {
      const [rangePart, stepPart] = segment.split('/');
      const step = stepPart ? Number(stepPart) : 1;

      if (!Number.isInteger(step) || step < 1) {
        return new Set<number>();
      }

      const [start, end] = this.resolveRange(rangePart, min, max);

      if (start < min || end > max || start > end) {
        return new Set<number>();
      }

      for (let value = start; value <= end; value += step) {
        values.add(value);
      }
    }

    return values;
  }

  private resolveRange(
    field: string,
    min: number,
    max: number,
  ): [number, number] {
    if (field === '*') {
      return [min, max];
    }

    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return [start, end];
    }

    const value = Number(field);
    return [value, value];
  }
}

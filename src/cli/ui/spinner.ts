import ora, { type Ora } from 'ora';
import { colors } from './theme.js';

/**
 * Spinner 封装——关键规则：任何 stdout 写入前必须先 stop()
 */
export class Spinner {
  private spinner: Ora | null = null;

  start(text: string): void {
    this.stop();
    this.spinner = ora({ text: colors.dim(text), spinner: 'dots' }).start();
  }

  update(text: string): void {
    if (this.spinner) {
      this.spinner.text = colors.dim(text);
    }
  }

  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  succeed(text: string): void {
    if (this.spinner) {
      this.spinner.succeed(colors.dim(text));
      this.spinner = null;
    }
  }

  fail(text: string): void {
    if (this.spinner) {
      this.spinner.fail(colors.toolError(text));
      this.spinner = null;
    }
  }
}

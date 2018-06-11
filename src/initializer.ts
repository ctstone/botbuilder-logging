import { Callback } from './callback';

interface InitState {
  ready?: boolean;
  working?: boolean;
  err?: Error;
}

export class Initializer {
  private state: InitState = {};
  private waitingForReady: Array<Callback<void>> = [];

  constructor(private initialize: (cb: Callback<void>) => void) {}

  afterInit(callback: Callback<void>): void {
    if (this.state.ready) {
      callback();
    } else if (this.state.err) {
      callback(this.state.err);
    } else if (this.state.working) {
      this.waitingForReady.push(callback);
    } else {
      this.state.working = true;
      this.initialize((err) => {
        callback(err);
        this.state.err = err;
        this.state.ready = !!err;
        this.state.working = false;
        this.waitingForReady.forEach((cb) => cb(err));
        this.waitingForReady.length = 0;
      });
    }
  }
}

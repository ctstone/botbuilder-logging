import { expect } from 'chai';
import { Initializer } from '../../src/initializer';

describe('Initializer', () => {
  describe('with successfull init', () => {
    let initializer: Initializer;
    let initCount: number;
    beforeEach(() => {
      initCount = 0;
      initializer = new Initializer((cb) => {
        initCount++;
        cb(null);
      });
    });

    it('inits only once', (done) => {
      initializer.afterInit((err) => {
        initializer.afterInit((err) => {
          expect(initCount).to.eq(1);
          done();
        });
      });
    });
  });

  describe('with failing init', () => {
    let initializer: Initializer;
    beforeEach(() => {
      initializer = new Initializer((cb) => cb(new Error('oops')));
    });

    it('raises init error at runtime', (done) => {
      initializer.afterInit((err) => {
        expect(err).to.be.a('Error');
        expect(err.message).to.eq('oops');
        done();
      });
    });
  });
});

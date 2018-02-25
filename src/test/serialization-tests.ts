import { expect } from 'chai';
import { Blob, serialize } from '../serialization';

describe('Serialization', () => {
  describe('of simple types', () => {
    const simpleValues: any[] = ['string', '', 123, 0, true, false];
    const simpleArray = simpleValues.concat({a: 1});
    const simpleObject = {a: {b: 1}, c: 2, d: null as any, e: 0, f: '', g: [1, 2]};

    simpleValues.forEach((val) => {
      it(`does not change the value of ${typeof val}`, () => {
        expect(serialize(val, null, null)).to.eq(val);
      });
    });

    it('does not change the value of null', () => {
      expect(serialize(null, null, null)).to.eq(null);
    });

    it('does not change array', () => {
      expect(serialize(simpleArray, null, null)).to.deep.eq(simpleArray);
    });

    it('does not change object', () => {
      expect(serialize(simpleObject, null, null)).to.deep.eq(simpleObject);
    });
  });

  describe('of function', () => {
    const obj = { f: () => 1 };
    it('removes function', () => {
      expect(serialize(obj, null, null)).to.deep.eq({ f: { $function: null } });
    });
  });

  describe('of error', () => {
    const obj = { err: new Error('foo') };
    it('converts to object', () => {
      expect(serialize(obj, null, null).err.$error).to.be.a('Object');
    });
    it('has error keys', () => {
      expect(serialize(obj, null, null).err.$error).to.have.all.keys('message', 'name', 'stack');
    });
  });

  describe('of buffer', () => {
    const obj = { b: Buffer.from('foo') };
    const handleBlobs = (blob: Blob) => 'http://somewhere.else';
    it('converts to locator string', () => {
      const blobs: Blob[] = [];
      expect(serialize(obj, handleBlobs, blobs)).to.deep.eq({ b: { $blob: 'http://somewhere.else' } });
    });

    it('returns blob array', () => {
      const blobs: Blob[] = [];
      serialize(obj, handleBlobs, blobs);
      expect(blobs.length).to.eq(1);
    });
  });

  describe('of date', () => {
    const obj = { d: new Date(Date.UTC(2018, 2 - 1, 25, 0, 0, 0, 0)) };
    it('converts to string', () => {
      expect(serialize(obj, null, null)).to.deep.eq({ d: '2018-02-25T00:00:00.000Z' });
    });
  });

  describe('of custom object', () => {
    class Foo {}
    const obj = { o: new Foo() };
    it('removes custom object', () => {
      const blobs: Blob[] = [];
      expect(serialize(obj, null, null)).to.deep.eq({ o: { $object: null } });
    });
  });
});

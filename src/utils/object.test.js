const { ObjectID } = require('mongodb');
const { propsToPaths } = require('./object');

describe('object utils', () => {
  describe('propsToPaths', () => {
    it('should be able to convet Notify to dotted-key/value pairs', () => {
      const original = {
        userId: ObjectID('5d1dcfad01333a01c9cd540c'),
        actionType: 1,
        settings: {
          email: {
            enabled: true,
            value: 'test@test.com'
          }
        }
      };

      const expected = {
        userId: ObjectID('5d1dcfad01333a01c9cd540c'),
        actionType: 1,
        'settings.email.enabled': true,
        'settings.email.value': 'test@test.com'
      };

      expect(propsToPaths(original)).toEqual(expected);
    });

    it('should not convert arrays', () => {
      const original = { test: [1, 2, 3] };

      const expected = { test: [1, 2, 3] };

      expect(propsToPaths(original)).toEqual(expected);
    });

    it('should not convert ObjectID', () => {
      const original = { test: ObjectID('5d1dcfad01333a01c9cd540c') };

      const expected = { test: ObjectID('5d1dcfad01333a01c9cd540c') };

      expect(propsToPaths(original)).toEqual(expected);
    });

    it('should handle array in nested propery', () => {
      const original = { prop1: { prop2: [1, 2, 3] } };

      const expected = { 'prop1.prop2': [1, 2, 3] };

      expect(propsToPaths(original)).toEqual(expected);
    });
  });
});

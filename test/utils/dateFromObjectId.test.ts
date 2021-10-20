import { ObjectId } from 'mongodb';
import { dateFromObjectId } from '../../src/utils/dates';

describe('dateFromObjectId', () => {
  it('should return correct Date object from Object ID', () => {
    /**
     * Arrange
     */
    const objectId = new ObjectId('612102b24b7a2b00231131b6');
    const expectedDate = new Date('2021-08-21T13:42:10.000Z');

    /**
     * Act
     */
    const parsedDate = dateFromObjectId(objectId);

    /**
     * Assert
     */
    expect(parsedDate).toStrictEqual(expectedDate);
  });
});

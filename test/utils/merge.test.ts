import { composeEventPayloadWithRepetition } from '../../src/utils/merge';
import { GroupedEventDBScheme, RepetitionDBScheme } from '@hawk.so/types';

import { diff } from '@n1ru4l/json-patch-plus';

describe('composeEventPayloadWithRepetition', () => {
    const mockOriginalEvent: GroupedEventDBScheme = {
        groupHash: 'original-event-1',
        totalCount: 1,
        catcherType: 'javascript',
        payload: {
            title: 'Original message',
            type: 'error',
            addons: JSON.stringify({ userId: 123 }),
            context: JSON.stringify({ sessionId: 'abc' }),
        },
        usersAffected: 1,
        visitedBy: [],
        timestamp: 1640995200, // 2023-01-01T00:00:00Z
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('when repetition is undefined', () => {
        it('should return a deep copy of the original event', () => {
            /**
             * Arrange
             */
            const repetition = undefined;

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(mockOriginalEvent.payload, repetition);

            /**
             * Assert
             */
            expect(result).toMatchObject(mockOriginalEvent.payload);
        });
    });

    describe('when repetition.delta is provided (new delta format)', () => {
        it('should parse addons and context, apply patch, and stringify fields back', () => {
            /**
             * Arrange
             */
            const delta = diff({
                left: mockOriginalEvent.payload,
                right: {
                    ...mockOriginalEvent.payload,
                    title: 'Updated message',
                    type: 'warning',
                },
            });

            const repetition: RepetitionDBScheme = {
                groupHash: 'original-event-1',
                timestamp: 1640995200,
                delta: JSON.stringify(delta),
            };

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(mockOriginalEvent.payload, repetition);

            /**
             * Assert
             */
            expect(result).toEqual({
                title: 'Updated message',
                type: 'warning',
                addons: JSON.stringify({ userId: 123 }),
                context: JSON.stringify({ sessionId: 'abc' }),
            });
        });

        it('should handle delta with new fields', () => {

            const originalEventPayload = {
                title: 'Original message',
                type: 'error',
                addons: JSON.stringify({ userId: 123 }),
                context: JSON.stringify({ sessionId: 'abc' }),
            };
            /**
             * Arrange
             */
            const delta = diff({
                left: originalEventPayload,
                right: {
                    ...originalEventPayload,
                    release: 'v1.0.0',
                    catcherVersion: '2.0.0',
                },
            });

            const repetition: RepetitionDBScheme = {
                groupHash: 'original-event-1',
                timestamp: 1640995200,
                delta: JSON.stringify(delta),
            };

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(originalEventPayload, repetition);

            /**
             * Assert
             */
            expect(result).toEqual({
                title: 'Original message',
                type: 'error',
                release: 'v1.0.0',
                catcherVersion: '2.0.0',
                addons: JSON.stringify({ userId: 123 }),
                context: JSON.stringify({ sessionId: 'abc' }),
            });
        });
    });

    describe('when repetition.delta is undefined and repetition.payload is undefined', () => {
        it('should return the original event unchanged', () => {
            /**
             * Arrange
             */
            const repetition: RepetitionDBScheme = {
                groupHash: 'original-event-1',
                timestamp: 1640995200,
                delta: undefined,
                payload: undefined,
            };

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(mockOriginalEvent.payload, repetition);

            /**
             * Assert
             */
            expect(result).toEqual(mockOriginalEvent.payload);
        });
    });

    describe('when repetition.delta is undefined and repetition.payload is provided (old delta format)', () => {

        const originalEventPayload = {
            title: 'Original message',
            type: 'error',
            addons: JSON.stringify({ userId: 123 }),
            context: JSON.stringify({ sessionId: 'abc' }),
        };

        it('should use repetitionAssembler to merge payloads', () => {
            /**
             * Arrange
             */
            const repetition: RepetitionDBScheme = {
                groupHash: 'original-event-1',
                timestamp: 1640995200,
                delta: undefined,
                payload: {
                    title: 'Updated message',
                    type: 'warning',
                    release: 'v1.0.0',
                },
            };

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(originalEventPayload, repetition);

            /**
             * Assert
             */
            expect(result).toEqual({
                title: 'Updated message',
                type: 'warning',
                release: 'v1.0.0',
                // Addons and context should be, because old format doesn't remove fields
                addons: JSON.stringify({ userId: 123 }),
                context: JSON.stringify({ sessionId: 'abc' }),
            });
        });

        it('should handle null values in repetition payload', () => {

            const originalEventPayload = {
                title: 'Original message',
                type: 'error',
                addons: JSON.stringify({ userId: 123 }),
                context: JSON.stringify({ sessionId: 'abc' }),
            };
            /**
             * Arrange
             */
            const repetition: RepetitionDBScheme = {
                groupHash: 'original-event-1',
                timestamp: 1640995200,
                delta: undefined,
                payload: {
                    title: 'Updated title',
                    type: 'info',
                },
            };

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(originalEventPayload, repetition);

            /**
             * Assert
             */
            expect(result).toEqual({
                title: 'Updated title', // repetition value replaces original
                type: 'info',
                // Addons and context should be, because old format doesn't remove fields
                addons: JSON.stringify({ userId: 123 }),
                context: JSON.stringify({ sessionId: 'abc' }),
            });
        });

        it('should preserve original value when repetition payload has null', () => {

            const originalEventPayload = {
                title: 'Original message',
                type: 'error',
                addons: JSON.stringify({ userId: 123 }),
                context: JSON.stringify({ sessionId: 'abc' }),
            };

            /**
             * Arrange
             */
            const repetition: RepetitionDBScheme = {
                groupHash: 'original-event-1',
                timestamp: 1640995200,
                delta: undefined,
                payload: {
                    title: null as any,
                    type: 'info',
                },
            };

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(originalEventPayload, repetition);

            /**
             * Assert
             */
            expect(result).toEqual({
                title: 'Original message', // null в repetition должно сохранить оригинальное значение
                type: 'info',
                addons: JSON.stringify({ userId: 123 }),
                context: JSON.stringify({ sessionId: 'abc' }),
            });
        });
    });

    describe('edge cases', () => {
        it('should handle empty payload in original event', () => {
            /**
             * Arrange
             */
            const eventWithEmptyPayload: GroupedEventDBScheme = {
                groupHash: 'event-4',
                totalCount: 1,
                catcherType: 'javascript',
                payload: {
                    title: 'Empty event',
                },
                usersAffected: 1,
                visitedBy: [],
                timestamp: 1640995200,
            };

            const delta = diff({
                left: eventWithEmptyPayload.payload,
                right: {
                    ...eventWithEmptyPayload.payload,
                    title: 'New message',
                },
            });

            const repetition: RepetitionDBScheme = {
                groupHash: 'event-4',
                timestamp: 1640995200,
                delta: JSON.stringify(delta),
            };

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(eventWithEmptyPayload.payload, repetition);

            /**
             * Assert
             */
            expect(result).toEqual({
                title: 'New message',
            });
        });

        it('should handle null payload in original event', () => {
            /**
             * Arrange
             */
            const eventWithNullPayload: GroupedEventDBScheme = {
                groupHash: 'event-5',
                totalCount: 1,
                catcherType: 'javascript',
                payload: null as any,
                usersAffected: 1,
                visitedBy: [],
                timestamp: 1640995200,
            };

            const delta = diff({
                left: eventWithNullPayload.payload,
                right: {
                    title: 'New message',
                },
            });

            const repetition: RepetitionDBScheme = {
                groupHash: 'event-5',
                timestamp: 1640995200,
                delta: JSON.stringify(delta),
            };

            /**
             * Act
             */
            const result = composeEventPayloadWithRepetition(eventWithNullPayload.payload, repetition);

            /**
             * Assert
             */
            expect(result).toEqual({
                title: 'New message',
            });
        });

        it('should handle invalid JSON in addons or context', () => {
            /**
             * Arrange
             */
            const eventWithInvalidJSON: GroupedEventDBScheme = {
                groupHash: 'event-6',
                totalCount: 1,
                catcherType: 'javascript',
                payload: {
                    title: 'Test',
                    addons: 'invalid json',
                    context: 'also invalid',
                },
                usersAffected: 1,
                visitedBy: [],
                timestamp: 1640995200,
            };

            const delta = diff({
                left: eventWithInvalidJSON.payload,
                right: {
                    ...eventWithInvalidJSON.payload,
                    title: 'Updated',
                },
            });

            const repetition: RepetitionDBScheme = {
                groupHash: 'event-6',
                timestamp: 1640995200,
                delta: JSON.stringify(delta),
            };

            /**
             * Act & Assert
             */
            expect(() => {
                composeEventPayloadWithRepetition(eventWithInvalidJSON.payload, repetition);
            }).toThrow(); // Должно выбросить ошибку при парсинге невалидного JSON
        });
    });
}); 
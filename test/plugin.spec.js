'use strict';

const Plugin = require('../');

describe('SQS Alarms Plugin', () => {
    let config;

    beforeEach(() => {
        config = {
            getProvider: () => ({ getRegion: () => 'test-region' }),
            service: {
                custom: {
                    'sqs-alarms': {
                        alarms: [{ queue: 'test-queue', topic: 'test-topic', thresholds: [1, 2, 3] }],
                    },
                },
                provider: {
                    compiledCloudFormationTemplate: {
                        Resources: {},
                    },
                },
            },
        };
    });

    it('creates CloudFormation configuration', () => {
        const test = new Plugin(config);
        test.beforeDeployResources();

        const data = config.service.provider.compiledCloudFormationTemplate.Resources;

        expect(data).toHaveProperty('testqueueMessageAlarm3');
        expect(data).toHaveProperty('testqueueMessageAlarm3.Type', 'AWS::CloudWatch::Alarm');
        expect(data).toHaveProperty('testqueueMessageAlarm3.Properties');
        expect(data).toHaveProperty(
            'testqueueMessageAlarm3.Properties.AlarmDescription',
            'Alarm if queue contains more than 3 messages'
        );
        expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.Threshold', 3);
    });

    describe('alarm name', () => {
        describe('is given', () => {
            it('adds alarm name to CloudFormation configuration', () => {
                config.service.custom['sqs-alarms'].alarms[0].name = 'alarm';

                const test = new Plugin(config);
                test.beforeDeployResources();

                const data = config.service.provider.compiledCloudFormationTemplate.Resources;

                expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.AlarmName', 'alarm-test-queue-3');
            });
        });

        describe('is not given', () => {
            it('adds no alarm name to CloudFormation configuration', () => {
                const test = new Plugin(config);
                test.beforeDeployResources();

                const data = config.service.provider.compiledCloudFormationTemplate.Resources;

                expect(data).not.toHaveProperty('testqueueMessageAlarm3.Properties.AlarmName');
            });
        });
    });

    it('creates alarms for multiple queues', () => {
        config.service.custom['sqs-alarms'].alarms.push({
            queue: 'test-queue-2',
            topic: 'test-topic',
            thresholds: [1, 2],
        });

        const test = new Plugin(config);
        test.beforeDeployResources();

        const data = config.service.provider.compiledCloudFormationTemplate.Resources;

        expect(data).toHaveProperty('testqueueMessageAlarm1');
        expect(data).toHaveProperty('testqueueMessageAlarm2');
        expect(data).toHaveProperty('testqueueMessageAlarm3');
        expect(data).toHaveProperty('testqueue2MessageAlarm1');
        expect(data).toHaveProperty('testqueue2MessageAlarm2');
    });

    it('does not fail without configuration', () => {
        delete config.service.custom['sqs-alarms'];

        const test = new Plugin(config);
        test.beforeDeployResources();

        const data = config.service.provider.compiledCloudFormationTemplate.Resources;

        expect(data).not.toHaveProperty('testqueueMessageAlarm3');
    });

    describe('alarm treatMissingData', () => {
        describe('is not provided', () => {
            it('adds alarm without treatMissingData property', () => {
                const test = new Plugin(config);
                test.beforeDeployResources();

                const data = config.service.provider.compiledCloudFormationTemplate.Resources;
                expect(data).not.toHaveProperty('testqueueMessageAlarm3.Properties.TreatMissingData');
            });
        });

        describe('is provided as a string of of a valid type', () => {
            it('adds alarms with treatMissingData property set to value for all alarms', () => {
                config.service.custom['sqs-alarms'].alarms[0].treatMissingData = 'notBreaching';

                const test = new Plugin(config);
                test.beforeDeployResources();

                const data = config.service.provider.compiledCloudFormationTemplate.Resources;

                expect(data).toHaveProperty('testqueueMessageAlarm1.Properties.TreatMissingData', 'notBreaching');
                expect(data).toHaveProperty('testqueueMessageAlarm2.Properties.TreatMissingData', 'notBreaching');
                expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.TreatMissingData', 'notBreaching');
            });
        });

        describe('is provided as a string an invalid type', () => {
            it('adds alarms with treatMissingData property set to value for all alarms', () => {
                config.service.custom['sqs-alarms'].alarms[0].treatMissingData = 'invalid';

                const test = new Plugin(config);
                test.beforeDeployResources();

                const data = config.service.provider.compiledCloudFormationTemplate.Resources;

                expect(data).not.toHaveProperty('testqueueMessageAlarm1.Properties.TreatMissingData');
                expect(data).not.toHaveProperty('testqueueMessageAlarm2.Properties.TreatMissingData');
                expect(data).not.toHaveProperty('testqueueMessageAlarm3.Properties.TreatMissingData');
            });
        });

        describe('is provided as an array of strings of valid types', () => {
            it('adds alarms with treatMissingData property set to corresponding value', () => {
                config.service.custom['sqs-alarms'].alarms[0].treatMissingData = [
                    'notBreaching',
                    'breaching',
                    'ignore',
                ];

                const test = new Plugin(config);
                test.beforeDeployResources();

                const data = config.service.provider.compiledCloudFormationTemplate.Resources;

                expect(data).toHaveProperty('testqueueMessageAlarm1.Properties.TreatMissingData', 'notBreaching');
                expect(data).toHaveProperty('testqueueMessageAlarm2.Properties.TreatMissingData', 'breaching');
                expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.TreatMissingData', 'ignore');
            });

            it('adds alarms with treatMissingData to only the alarms with matching index', () => {
                config.service.custom['sqs-alarms'].alarms[0].treatMissingData = ['notBreaching', 'breaching'];

                const test = new Plugin(config);
                test.beforeDeployResources();

                const data = config.service.provider.compiledCloudFormationTemplate.Resources;

                expect(data).toHaveProperty('testqueueMessageAlarm1.Properties.TreatMissingData', 'notBreaching');
                expect(data).toHaveProperty('testqueueMessageAlarm2.Properties.TreatMissingData', 'breaching');
                expect(data).not.toHaveProperty('testqueueMessageAlarm3.Properties.TreatMissingData');
            });

            it('adds alarms with treatMissingData ignoring ivalid types', () => {
                config.service.custom['sqs-alarms'].alarms[0].treatMissingData = ['notBreaching', 'invalid', 'missing'];

                const test = new Plugin(config);
                test.beforeDeployResources();

                const data = config.service.provider.compiledCloudFormationTemplate.Resources;

                expect(data).toHaveProperty('testqueueMessageAlarm1.Properties.TreatMissingData', 'notBreaching');
                expect(data).not.toHaveProperty('testqueueMessageAlarm2.Properties.TreatMissingData');
                expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.TreatMissingData', 'missing');
            });
        });
    });

    it('creates CloudFormation configuration with custom thresholds', () => {
        config = {
            getProvider: () => ({ getRegion: () => 'test-region' }),
            service: {
                custom: {
                    'sqs-alarms': {
                        alarms: [
                            {
                                queue: 'test-queue',
                                topic: 'test-topic',
                                thresholds: [
                                    {
                                        value: 1,
                                        period: 5,
                                        evaluationPeriods: 1,
                                    },
                                    {
                                        value: 2,
                                        period: 5,
                                        evaluationPeriods: 1,
                                    },
                                    {
                                        value: 3,
                                        period: 5,
                                        evaluationPeriods: 1,
                                        namespace: 'test',
                                    },
                                ],
                            },
                        ],
                    },
                },
                provider: {
                    compiledCloudFormationTemplate: {
                        Resources: {},
                    },
                },
            },
        };

        const test = new Plugin(config);
        test.beforeDeployResources();

        const data = config.service.provider.compiledCloudFormationTemplate.Resources;

        expect(data).toHaveProperty('testqueueMessageAlarm3');
        expect(data).toHaveProperty('testqueueMessageAlarm3.Type', 'AWS::CloudWatch::Alarm');
        expect(data).toHaveProperty('testqueueMessageAlarm3.Properties');
        expect(data).toHaveProperty(
            'testqueueMessageAlarm3.Properties.AlarmDescription',
            'Alarm if queue contains more than 3 messages'
        );
        expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.Threshold', 3);
        expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.EvaluationPeriods', 1);
        expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.Period', 5);
        expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.Namespace', 'test');
    });

    describe('stages', () => {
        let options;
        let utils;
        beforeEach(() => {
            options = { stage: 'dev' };
            utils = {
                log: () => {}, //do nothing
            };
        });

        it('creates CloudFormation configuration when stages are not defined', () => {
            const test = new Plugin(config, options, utils);
            test.beforeDeployResources();

            const data = config.service.provider.compiledCloudFormationTemplate.Resources;

            expect(data).toHaveProperty('testqueueMessageAlarm3');
            expect(data).toHaveProperty('testqueueMessageAlarm3.Type', 'AWS::CloudWatch::Alarm');
            expect(data).toHaveProperty('testqueueMessageAlarm3.Properties');
            expect(data).toHaveProperty(
                'testqueueMessageAlarm3.Properties.AlarmDescription',
                'Alarm if queue contains more than 3 messages'
            );
            expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.Threshold', 3);
        });

        it('creates CloudFormation configuration when stages are defined and current stage IS in the list', () => {
            config.service.custom['sqs-alarms'].stages = ['dev'];

            const test = new Plugin(config, options, utils);
            test.beforeDeployResources();

            const data = config.service.provider.compiledCloudFormationTemplate.Resources;

            expect(data).toHaveProperty('testqueueMessageAlarm3');
            expect(data).toHaveProperty('testqueueMessageAlarm3.Type', 'AWS::CloudWatch::Alarm');
            expect(data).toHaveProperty('testqueueMessageAlarm3.Properties');
            expect(data).toHaveProperty(
                'testqueueMessageAlarm3.Properties.AlarmDescription',
                'Alarm if queue contains more than 3 messages'
            );
            expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.Threshold', 3);
        });

        it('does not create CloudFormation configuration when stages are defined and current stage IS NOT in the list', () => {
            config.service.custom['sqs-alarms'].stages = ['live'];

            const test = new Plugin(config, options, utils);
            test.beforeDeployResources();

            const data = config.service.provider.compiledCloudFormationTemplate.Resources;

            expect(data).not.toHaveProperty('testqueueMessageAlarm3');
        });
    });

    describe('okAlerts', () => {
        it('is undefined then OKActions is set', () => {
            const test = new Plugin(config);
            test.beforeDeployResources();

            const data = config.service.provider.compiledCloudFormationTemplate.Resources;

            expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.OKActions');
        });

        it('is true then OKActions is set', () => {
            const test = new Plugin(config);
            test.beforeDeployResources();

            const data = config.service.provider.compiledCloudFormationTemplate.Resources;

            expect(data).toHaveProperty('testqueueMessageAlarm3.Properties.OKActions');
        });

        it('is false then OKActions is not set', () => {
            config.service.custom['sqs-alarms'].alarms[0].okAlerts = false;
            const test = new Plugin(config);
            test.beforeDeployResources();

            const data = config.service.provider.compiledCloudFormationTemplate.Resources;

            expect(data).not.toHaveProperty('testqueueMessageAlarm1.Properties.OKActions');
            expect(data).not.toHaveProperty('testqueueMessageAlarm2.Properties.OKActions');
            expect(data).not.toHaveProperty('testqueueMessageAlarm3.Properties.OKActions');
        });
    });
});


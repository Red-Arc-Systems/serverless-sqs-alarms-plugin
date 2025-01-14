'use strict';

const _ = require('lodash');
const util = require('util');

class Alarm {
    constructor(alarm, region) {
        this.queue = alarm.queue;
        this.topic = alarm.topic;
        this.region = region;
        this.thresholds = alarm.thresholds;
        this.name = alarm.name;
        this.treatMissingData = alarm.treatMissingData;
        this.okAlerts = alarm.okAlerts === undefined ? true : alarm.okAlerts;
    }

    formatAlarmName(value) {
        // Cloud Watch alarms must be alphanumeric only
        let queue = this.queue.replace(/[^0-9a-z]/gi, '');
        return util.format(queue + 'MessageAlarm%s', value);
    }

    resolveTreatMissingData(index) {
        if (this.treatMissingData.constructor === Array) {
            return this.validateTreatMissingData(this.treatMissingData[index]);
        } else {
            return this.validateTreatMissingData(this.treatMissingData);
        }
    }

    validateTreatMissingData(treatment) {
        let validTreamtments = ['missing', 'ignore', 'breaching', 'notBreaching'];
        if (validTreamtments.includes(treatment)) {
            return treatment;
        }
    }

    resourceProperties(value) {
        if (value instanceof Object) {
            return value;
        }

        return {
            value,
        };
    }

    resources() {
        return this.thresholds.map((props, i) => {
            const properties = this.resourceProperties(props);

            const config = {
                [this.formatAlarmName(properties.value)]: {
                    Type: 'AWS::CloudWatch::Alarm',
                    Properties: {
                        AlarmDescription: util.format(
                            'Alarm if queue contains more than %s messages',
                            properties.value
                        ),
                        Namespace: properties.namespace || 'AWS/SQS',
                        MetricName: 'ApproximateNumberOfMessagesVisible',
                        Dimensions: [
                            {
                                Name: 'QueueName',
                                Value: this.queue,
                            },
                        ],
                        Statistic: 'Sum',
                        Period: properties.period || 60,
                        EvaluationPeriods: properties.evaluationPeriods || 1,
                        Threshold: properties.value,
                        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
                        AlarmActions: [
                            {
                                'Fn::Join': [
                                    '',
                                    ['arn:aws:sns:' + this.region + ':', { Ref: 'AWS::AccountId' }, ':' + this.topic],
                                ],
                            },
                        ],
                        OKActions: [
                            {
                                'Fn::Join': [
                                    '',
                                    ['arn:aws:sns:' + this.region + ':', { Ref: 'AWS::AccountId' }, ':' + this.topic],
                                ],
                            },
                        ],
                    },
                },
            };

            if (!this.okAlerts) {
                delete config[this.formatAlarmName(properties.value)].Properties.OKActions;
            }

            if (this.name) {
                config[this.formatAlarmName(properties.value)].Properties.AlarmName = util.format(
                    '%s-%s-%d',
                    this.name,
                    this.queue,
                    properties.value
                );
            }

            if (this.treatMissingData) {
                let treatMissing = this.resolveTreatMissingData(i);
                if (treatMissing) {
                    config[this.formatAlarmName(properties.value)].Properties.TreatMissingData = treatMissing;
                }
            }
            return config;
        });
    }
}

class Plugin {
    constructor(serverless, options, utils) {
        this.serverless = serverless;
        this.options = options; // CLI options
        this.utils = utils;
        this.hooks = {
            'package:compileEvents': this.beforeDeployResources.bind(this),
        };
    }

    beforeDeployResources() {
        if (!this.serverless.service.custom || !this.serverless.service.custom['sqs-alarms']) {
            return;
        }

        if (
            Array.isArray(this.serverless.service.custom['sqs-alarms'].stages) &&
            !this.serverless.service.custom['sqs-alarms'].stages.includes(this.options.stage)
        ) {
            this.utils.log(`Info: Not deploying dashboards on stage ${this.options.stage}`);
            return;
        }

        const alarms = this.serverless.service.custom['sqs-alarms'].alarms.map(
            (data) => new Alarm(data, this.serverless.getProvider('aws').getRegion())
        );

        alarms.forEach((alarm) =>
            alarm.resources().forEach((resource) => {
                _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, resource);
            })
        );
    }
}

module.exports = Plugin;


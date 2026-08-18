const StateMachine = require("../../state/StateMachine");
const EventEngine = require("../../events/EventEngine");
const TelemetryModel = require("../../telemetry/TelemetryModel");

class BaseAsset {

    constructor(assetId, assetType, healthModel) {

        this.assetId = assetId;
        this.assetType = assetType;

        this.stateMachine = new StateMachine();

        this.healthModel = healthModel;

        this.telemetry = {};
        this.health = {};
        this.assetState = null;
        this.events = [];
        this.packet = null;
    }

    update(environment) {

        this.telemetry =
            this.calculateTelemetry(environment);

        this.health =
            this.calculateHealth();

        this.assetState =
            this.updateState(environment);

        this.events =
            this.evaluateEvents(environment);

        this.packet =
            this.createPacket(environment);

        return this.packet;
    }

    calculateTelemetry(environment) {
        throw new Error("calculateTelemetry() must be implemented.");
    }

    calculateHealth() {

        if (!this.healthModel) {
            throw new Error(
                `Health model not configured for asset ${this.assetId}`
            );
        }

        return this.healthModel.calculateHealth(
            this.telemetry
        );

    }

    updateState(environment) {

        const operationalState =
            this.determineOperationalState(environment);

        return this.stateMachine.update(
            this.health.healthScore,
            operationalState
        );

    }

    determineOperationalState(environment) {
        return null;
    }

    evaluateEvents(environment) {

        return EventEngine.evaluate({

            assetId: this.assetId,

            assetType: this.assetType,

            assetState: this.assetState,

            environment,

            telemetry: this.telemetry,

            health: this.health

        });

    }

    createPacket(environment) {

        return TelemetryModel.create(

            this.assetId,

            {

                assetId: this.assetId,

                assetType: this.assetType,

                assetState: this.assetState,

                environment,

                telemetry: this.telemetry,

                health: this.health,

                events: this.events

            }

        );

    }

}

module.exports = BaseAsset;
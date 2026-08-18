class EventRules {

    static evaluate(simulationData) {

        const events = [];

        this.checkFilterClogging(simulationData, events);
        this.checkHighTemperature(simulationData, events);
        this.checkRefrigerantLeak(simulationData, events);
        this.checkCompressorOvercurrent(simulationData, events);
        this.checkImminentFailure(simulationData, events);

        return events;
    }

    static checkHighTemperature(simulationData, events) {
        const { telemetry, assetState } = simulationData;
        if (telemetry.supplyAirTemperature > 25) {
            events.push({
                eventType: "HIGH_SUPPLY_TEMPERATURE",
                severity: telemetry.supplyAirTemperature > 28 ? "CRITICAL" : "WARNING",
                assetState
            });
        }
    }

    static checkRefrigerantLeak(simulationData, events) {
        const { telemetry, assetState } = simulationData;
        if (telemetry.refrigerantCharge !== undefined && telemetry.refrigerantCharge < 0.85) {
            events.push({
                eventType: "REFRIGERANT_LOW",
                severity: telemetry.refrigerantCharge < 0.6 ? "CRITICAL" : "WARNING",
                assetState
            });
        }
    }

    static checkCompressorOvercurrent(simulationData, events) {
        const { telemetry, assetState } = simulationData;
        if (telemetry.compressorCurrent > 24) {
            events.push({
                eventType: "COMPRESSOR_OVERCURRENT",
                severity: telemetry.compressorCurrent > 28 ? "CRITICAL" : "WARNING",
                assetState
            });
        }
    }

    static checkImminentFailure(simulationData, events) {
        const { health, assetState } = simulationData;
        if (health.healthScore <= 15) {
            events.push({
                eventType: "IMMINENT_FAILURE",
                severity: "CRITICAL",
                assetState
            });
        }
    }

    static checkFilterClogging(simulationData, events) {

        const {
            telemetry,
            health,
            assetState
        } = simulationData;

        if (
            telemetry.filterDP > 250 &&         
            telemetry.compressorCurrent > 22 &&  
            health.healthScore < 75
        ) {
            events.push({
                eventType: "FILTER_CLOGGING_WARNING",
                severity: "WARNING",
                assetState
            });
        }
    }

}

module.exports = EventRules;
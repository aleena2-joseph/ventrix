class TelemetryModel {
    static create(assetId, simulationData) {
        return {
            assetId,
            timestamp: new Date().toISOString(),
            assetState: simulationData.assetState,
            environment: simulationData.environment,
            telemetry: simulationData.telemetry,
            health: simulationData.health,
            events: simulationData.events || []
        };
    }
}
module.exports = TelemetryModel;
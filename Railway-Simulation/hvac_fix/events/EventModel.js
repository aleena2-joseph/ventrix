class EventModel {
    static create({
        assetId,
        eventType,
        severity,
        assetState,
        healthScore,
        telemetrySnapshot
    }) {
        return {
            eventId: `EVT-${Date.now()}`,
            timestamp: new Date().toISOString(),
            assetId,
            eventType,
            severity,
            assetState,
            healthScore,
            telemetrySnapshot
        };
    }
}

module.exports = EventModel;
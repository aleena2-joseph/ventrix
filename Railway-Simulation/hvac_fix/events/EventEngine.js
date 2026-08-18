const EventModel = require("./EventModel");
const EventRules = require("./EventRules");

class EventEngine {

    static evaluate(simulationData) {

        const ruleResults = EventRules.evaluate(simulationData);

        const events = ruleResults.map(rule =>
            EventModel.create({
                assetId: simulationData.assetId,
                eventType: rule.eventType,
                severity: rule.severity,
                assetState: rule.assetState,
                healthScore: simulationData.health.healthScore,
                telemetrySnapshot: simulationData.telemetry
            })
        );

        return events;
    }

}

module.exports = EventEngine;
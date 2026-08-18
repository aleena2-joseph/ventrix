const KafkaProducer = require("../kafka/KafkaProducer");
class TelemetryPublisher {

    // silent=true skips the console dashboard redraw -- useful when running
    // many ticks quickly (e.g. accelerated demo runs) where a full-screen
    // JSON dump every tick just slows things down.
    constructor(silent = false) {

        this.kafkaProducer = new KafkaProducer();
        this.silent = silent;
    }
    async initialize() {

    await this.kafkaProducer.connect();

}

    async publish(tickCount, telemetry) {

        if (!this.silent) {

        console.clear();

        console.log("================================");
        console.log(" Railway HVAC Simulation");
        console.log("================================");

        console.log(
            `Tick         : ${tickCount}`
        );

        console.log(
            `Asset        : ${telemetry.assetId}`
        );

        console.log(
            `Asset State  : ${telemetry.assetState}`
        );

        console.log(
            `Health Score : ${telemetry.health.healthScore}`
        );

        console.log(
            `Health Status: ${telemetry.health.healthStatus}`
        );

        console.log("");

        console.log(
            JSON.stringify(telemetry, null, 2)
        );

        }

        await this.kafkaProducer.publish(
                "simulation.telemetry", telemetry);

    }

    async shutdown() {
        await this.kafkaProducer.disconnect();
    }

}

module.exports = TelemetryPublisher;

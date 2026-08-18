const { Kafka } = require("kafkajs");

class KafkaProducer {

    constructor() {

        this.kafka = new Kafka({
            clientId: "railway-simulator",
            // Was hardcoded to a private IP (100.66.251.9), which breaks on
            // any other machine/network. Reads from env var with a sane
            // localhost default that matches kafka/docker-compose.yml.
            brokers: [process.env.KAFKA_BROKER || "localhost:9092"]
        });

        this.producer = this.kafka.producer();

        this.connected = false;
    }

    async connect() {

        try {

            if (this.connected) return;

            await this.producer.connect();

            this.connected = true;

            console.log("✅ Kafka Producer Connected");

            } catch (err) {

                console.error("❌ Failed to connect to Kafka");

                console.error(err);

                throw err;

            }
}

    async publish(topic, message) {

        if (!this.connected) {
            throw new Error("Kafka producer is not connected.");
        }

        await this.producer.send({

            topic,

            messages: [
                {
                    value: JSON.stringify(message)
                }
            ]

        });

    }

    async disconnect() {

        if (!this.connected) return;

        await this.producer.disconnect();

        this.connected = false;
    }

}

module.exports = KafkaProducer;
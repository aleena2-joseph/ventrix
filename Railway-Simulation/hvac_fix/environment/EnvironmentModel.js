class EnvironmentModel {

    constructor() {

        // Ambient Conditions
        this.environment = {

            // Outside environmental conditions
            ambientTemperature: 30,      // °C
            humidity: 60,                // %
            atmosphericPressure: 101.3,  // kPa

            // Train operating conditions
            passengerCount: 120,         // passengers
            trainSpeed: 80,              // km/h
            doorOpenPercentage: 0,       // %

            // Electrical conditions
            supplyVoltage: 415,          // V
            supplyFrequency: 50,         // Hz

            // Asset information
            operatingHours: 0            // hours
        };

    }

    round(value) {
        return Number(value.toFixed(2));
    }

    update(deltaTime = 1) {

        // Convert seconds to operating hours.
        // If update() is called every second,
        // operatingHours increases realistically.
        this.environment.operatingHours += deltaTime / 3600;
        this.environment.operatingHours =
            this.environment.operatingHours;
    }

    evolve() {

        // Passenger count changes gradually
        this.environment.passengerCount +=
            Math.floor(Math.random() * 11) - 5;

        this.environment.passengerCount =
            Math.max(
                40,
                Math.min(320, this.environment.passengerCount)
            );

        this.environment.humidity +=
            (Math.random() - 0.5) * 0.2;

        this.environment.humidity =
            this.round(this.environment.humidity);

        // Train speed changes gradually
        this.environment.trainSpeed +=
            Math.floor(Math.random() * 7) - 3;

        this.environment.trainSpeed =
            Math.max(
                0,
                Math.min(110, this.environment.trainSpeed)
            );

        // Ambient temperature changes slowly
        this.environment.ambientTemperature +=
            (Math.random() - 0.5) * 0.2;

        this.environment.ambientTemperature =
            this.round(this.environment.ambientTemperature);

        // Voltage fluctuates slightly
        this.environment.supplyVoltage +=
            (Math.random() - 0.5) * 0.5;

        this.environment.supplyVoltage =
            this.round(this.environment.supplyVoltage);
    }

    setEnvironment(newEnvironment) {

    this.environment = {

        ...this.environment,

        ...newEnvironment

    };

}

    getMutableEnvironment() {

    return this.environment;

}

    getEnvironment() {

        return {
            ...this.environment
        };

    }

}

module.exports = EnvironmentModel;
const AssetState = require("./AssetState");

class StateMachine {

    constructor() {

        this.currentState = AssetState.HEALTHY;

    }

    update(health, operationalState = null) {

        if (health < 40) {

            this.currentState = AssetState.ALARM;

        }
        else if (health < 60) {

            this.currentState = AssetState.WARNING;

        }
        else if (health < 80) {

            this.currentState = AssetState.DEGRADING;

        }
        else if (operationalState) {

            this.currentState = operationalState;

        }
        else {

            this.currentState = AssetState.HEALTHY;

        }

        return this.currentState;

    }

    getCurrentState() {

        return this.currentState;

    }

}

module.exports = StateMachine;
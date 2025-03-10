@component
export class PlayerSpeedCalculator extends BaseScriptComponent {

    private oPos: vec3;
    private t: number;
    private cps: number;

    // How often we calculate speed in seconds
    private testIncrement: number;

    start(pos:vec3){
        this.t = 0;
        this.cps = 0;
        this.testIncrement = .5;
        this.oPos = pos;
    }

    getSpeed(pos:vec3){
        let dt = getDeltaTime();
        this.t += dt;
        let dist = 0;

        if (this.t > this.testIncrement) {

            // Cm moved since last sample
            dist = pos.distance(this.oPos);
            this.oPos = pos;

            // Speed in cm per sec (cps)
            this.cps = dist / this.t;

            this.t = 0;
        }

        return {nPos: pos, speed: this.cps, dist, dt};
    }
}

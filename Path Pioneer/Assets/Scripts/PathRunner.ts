import { ProgressBarController } from "./ProgressBarController";
import { SoundController } from "./SoundController";
import { Timer } from "./Timer"
import { UI } from "./UI";
import { ArrowsSpawner } from "./ArrowsSpawner";
import { LensInitializer } from "./LensInitializer";
import { CatmullRomSpline } from "./Helpers/CatmullRomSpline";
import { PathBuilder } from "./PathBuilder";
import { Conversions } from "./Conversions";
import { PlayerSpeedCalculator } from "./PlayerSpeedCalculator";
import { LineController } from "./LineController";
import { LinearAlgebra } from "./Helpers/LinearAlgebra";

enum PathRunnerState {
    None,
    GoToStart,
    Running
}

@component
export class PathRunner extends BaseScriptComponent {

    @input
    cam: SceneObject

    @input
    runPathScreenHUD: SceneObject

    @input
    paceText: Text

    @input
    lapCountText: Text

    @input
    timerScript: Timer

    @input
    uiScript: UI

    @input
    progressBarController: ProgressBarController

    @input
    arrowSpawner: ArrowsSpawner

    @input
    playerSpeedCalulator: PlayerSpeedCalculator

    @input
    protected pathRmv: RenderMeshVisual;

    // State data
    private state: number = 0;
    private isOutsideSprint: boolean = false;
    public lapCount: number = -1;
    private totalTimeRunning: number = 0;
    private totalDistRun: number = 0;
    private onRunningFinished: (() => void) | undefined = undefined;

    // Path data
    private splinePoints: { position: vec3; rotation: quat }[] = []; // batched update based on resolution
    private pathPoints: vec3[] = null;
    private isLoop: boolean = false;
    private pathIsForwards: boolean = true; // Starting orientation
    private startLineController: LineController = null;
    private finishLineController: LineController = null;
    private pathLength: number = 0;

    // Ui Related data
    private isUiShown: boolean = false;
    private currentState = PathRunnerState.None;

    public init() {
        this.uiScript.endSessionClicked.add(() => {
            this.stop();
            if (this.onRunningFinished) {
                this.onRunningFinished();
            }
        });
        this.resetState();
    }

    private onUpdate() {
        if (getDeltaTime() < 1/6000) {
            // we're in a capture loop
            return;
        }

        switch (this.state) {
            case 0: // inactive
                break;
            case 1: // prep
                break;
            case 2: // running
                let stats = this.playerSpeedCalulator.getSpeed(LensInitializer.getInstance().getPlayerGroundPos());
                if (stats.speed > 13) {
                    this.ensureUiHidden();
                } else {
                    this.ensureUiShown();
                }

                if (!this.isOutsideSprint) {
                    let t = this.getSplinePos().t;
                    this.updateProgressBar(t);

                    this.setPlayerStats(stats);
                }
                break;
            case 3: // finished
                break;
            default:
                break;
        }
    }

    private getSplinePos() {
        return CatmullRomSpline.worldToSplineSpace(LensInitializer.getInstance().getPlayerGroundPos(), this.splinePoints);
    }

    private updateProgressBar(t: number) {
        let addjustedT = this.pathIsForwards ? t : 1 - t;
        this.progressBarController.setProgress(addjustedT);
    }

    private setPlayerStats(stats: { nPos: vec3, speed: number, dist: number, dt: number }) {
        // calculate and update total average speed text
        this.totalDistRun += stats.dist;
        this.totalTimeRunning += stats.dt;
        if (this.totalTimeRunning > 0) {
            let paceMPH = Conversions.cmPerSecToMPH(this.totalDistRun / this.totalTimeRunning);
            this.paceText.text = paceMPH.toFixed(1);
        }
    }

    public onStartCollisionExit(dot: number) {
        if (dot > 0) {
            // We are in the direction of the start line
            if (this.state === 1) { // prep
                // We passed start for the first time
                this.playerSpeedCalulator.start(LensInitializer.getInstance().getPlayerGroundPos());
                this.runPathScreenHUD.enabled = true;
                this.updateProgressBar(0);
                this.lapCount = 0;
                this.currentState = PathRunnerState.Running;
                this.updateUi();
                this.timerScript.start();
                this.state = 2;

                SoundController.getInstance().playSound("startRunPath");

                // SoundController.getInstance().playSound("onStartLap");

                this.arrowSpawner.start(this.pathPoints.concat([]).reverse(), this.splinePoints, this.pathLength);

                // We show the lap we will complete once we run through
                if (this.isLoop) {
                    this.startLineController.onIncrementLoop(this.lapCount + 1);
                } else {
                    this.startLineController.onStartSprint();
                    this.finishLineController.onStartSprint();
                }
            } else if (this.state === 2) { // running
                if (this.isLoop) {
                    // We are making a lap in the loop
                    this.incrementLap();
                } else {
                    // We are re-entering sprint
                    SoundController.getInstance().playSound("onStartLap");
                    this.isOutsideSprint = false;
                }
                this.timerScript.start();
            }
        } else {
            // We are going in reverse direction of the start line
            if (this.state === 2) { // running
                if (this.isLoop) {
                    // There is no use case for this
                } else {
                    // We are finishing reverse sprint
                    this.timerScript.pause();
                    this.isOutsideSprint = true;
                    this.incrementLap();
                    this.reverseSprintTrackVisuals("start");
                }
            }
        }
    }

    public onFinishCollisionExit(dot: number) {
        if (dot > 0) {
            if (this.state === 2) {
                // We are finishing sprint
                this.timerScript.pause();
                this.isOutsideSprint = true;
                this.incrementLap();
                this.reverseSprintTrackVisuals("finish");
            }
        } else {
            if (this.state === 2) {
                // We are re-entering reverse sprint
                SoundController.getInstance().playSound("onStartLap");
                this.isOutsideSprint = false;
                this.timerScript.start();
            }
        }
    }

    private incrementLap() {
        SoundController.getInstance().playSound("onCompleteLap");
        this.timerScript.incrementLap();
        this.lapCount++;
        this.lapCountText.text = this.lapCount.toString();
        if (this.isLoop) {
            this.startLineController.onIncrementLoop(this.lapCount + 1);
        }
    }

    onSprintStartAreaCollision(reverseTrack:boolean){
        if(!this.isLoop){
            this.startLineController.onSprintStartAreaCollision();
            this.finishLineController.onSprintStartAreaCollision();
    
            if(reverseTrack){
                this.reverseSprintTrack();
            }
        }
    }

    private reverseSprintTrack(){
        // Fully switch positions of start and end 
        let startPos = this.startLineController.getTransform().getWorldPosition();
        let startRot = this.startLineController.getTransform().getWorldRotation();
        let flippedStartRot = LinearAlgebra.flippedRot(startRot, this.startLineController.getTransform().up);

        let finishPos = this.finishLineController.getTransform().getWorldPosition();
        let finishRot = this.finishLineController.getTransform().getWorldRotation();
        let flippedFinishRot = LinearAlgebra.flippedRot(finishRot, this.finishLineController.getTransform().up);

        this.startLineController.getTransform().setWorldPosition(finishPos);
        this.startLineController.getTransform().setWorldRotation(flippedFinishRot);
        this.finishLineController.getTransform().setWorldPosition(startPos);
        this.finishLineController.getTransform().setWorldRotation(flippedStartRot);

        // Revese spline
        this.splinePoints = this.splinePoints.reverse();

        // Only reverse relevant visuals
        this.pathPoints = this.pathPoints.reverse();
        this.pathRmv.mesh = PathBuilder.buildFromPoints(this.pathPoints, 60);
        this.arrowSpawner.start(this.pathPoints.concat([]).reverse(), this.splinePoints, this.pathLength);
    }

    private reverseSprintTrackVisuals(str: string) {
        let reverseTrack = false;

        if (str.includes("start") && !this.pathIsForwards) {
            this.pathIsForwards = true;
            reverseTrack = true;
        }
        if (str.includes("finish") && this.pathIsForwards) {
            this.pathIsForwards = false;
            reverseTrack = true;
        }
        if (reverseTrack) {
            this.pathPoints = this.pathPoints.reverse();
            this.pathRmv.mesh = PathBuilder.buildFromPoints(this.pathPoints, 60);
            this.arrowSpawner.start(this.pathPoints.concat([]).reverse(), this.splinePoints, this.pathLength);
            this.startLineController.onReverseSprintTrackVisuals();
            this.finishLineController.onReverseSprintTrackVisuals();
        }
    }

    private resetState() {
        // State data
        this.state = 0;
        this.isOutsideSprint = false;
        this.lapCount = -1;
        this.totalTimeRunning = 0;
        this.totalDistRun = 0;

        // Path data
        this.pathIsForwards = true;
        this.splinePoints = [];
        this.pathPoints = [];
        this.isLoop = false;

        // Path visual
        this.pathRmv.enabled = false;
        this.arrowSpawner.stop();
        if (this.startLineController) {
            this.startLineController.getSceneObject().destroy();
            this.startLineController = null;
        }
        if (this.finishLineController) {
            this.finishLineController.getSceneObject().destroy();
            this.finishLineController = null;
        }

        // HUD
        if(this.timerScript.getSceneObject().isEnabledInHierarchy){
            this.timerScript.stop();
        }
        this.paceText.text = "0";
        this.lapCountText.text = "0";

        this.runPathScreenHUD.enabled = false;

        // UI data
        this.ensureUiHidden();
    }

    public start(
        mySplinePoints: { position: vec3, rotation: quat }[],
        myIsLoop: boolean,
        myStartLineTr: Transform,
        myFinishLineTr: Transform | undefined = undefined,
        onRunningFinished: (() => void) | undefined = undefined,
    ) {
        // state
        this.resetState();
        this.state = 1;

        // Set path data from PathMaker
        this.splinePoints = mySplinePoints;
        this.pathPoints = mySplinePoints.map(s => s.position);
        this.pathLength = 0;
        for (let i = 1; i < this.pathPoints.length; i++) {
            this.pathLength += this.pathPoints[i].distance(this.pathPoints[i - 1]);
        }
        this.isLoop = myIsLoop;
        this.pathRmv.mesh = PathBuilder.buildFromPoints(this.pathPoints.reverse(), 60);
        this.pathRmv.enabled = true;

        this.startLineController = myStartLineTr.getSceneObject().getComponent(LineController.getTypeName());
        this.startLineController.setEnableRunCountdown();

        if (!isNull(myFinishLineTr)) {
            this.finishLineController = myFinishLineTr.getSceneObject().getComponent(LineController.getTypeName());
            this.finishLineController.setEnableRunCountdown();
        }

        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
        this.currentState = PathRunnerState.GoToStart;
        this.ensureUiShown();
        this.onRunningFinished = onRunningFinished;

        this.arrowSpawner.start(this.pathPoints.concat([]).reverse(), this.splinePoints, this.pathLength);
    }

    public stop() { 
        SoundController.getInstance().stopAllSounds();
        this.resetState();
    }

    private ensureUiShown() {
        if (this.isUiShown) {
            return;
        }
        this.isUiShown = true;
        this.showUi();
    }

    private ensureUiHidden() {
        if (!this.isUiShown) {
            return;
        }
        this.isUiShown = false;
        this.uiScript.hideUi();
    }

    private updateUi() {
        if (!this.isUiShown) {
            return;
        }
        this.showUi();
    }

    private showUi() {
        switch (this.currentState) {
            case PathRunnerState.None:
                return
            case PathRunnerState.GoToStart:
                this.uiScript.showGoToStartUi(this.pathLength);
                return;
            case PathRunnerState.Running:
                this.uiScript.showEndSessionUi();
                return;
        }
    }
}

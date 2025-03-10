import { PathRunner } from "./PathRunner";

@component
export class PathCollisionEvents extends BaseScriptComponent {

    private msg:string;

    private col:ColliderComponent;
    private tr:Transform;

    private pathRunner:PathRunner

    private camTr:Transform;
    private camCol:ColliderComponent;

    private enterPoint:vec3 = null;

    init(myMsg:string, myCamTr:Transform, myCamCol:ColliderComponent, myPathRunner:PathRunner){
        this.msg = myMsg;
        this.camTr = myCamTr;
        this.camCol = myCamCol;
        this.pathRunner = myPathRunner;

        this.tr = this.sceneObject.getTransform();
        this.col = this.sceneObject.getChild(0).getComponent("ColliderComponent");
        this.col.onCollisionEnter.add((e:CollisionEnterEventArgs)=>this.onCollisionEnter(e));
        this.col.onCollisionExit.add((e:CollisionExitEventArgs)=>this.onCollisionExit(e));
    }

    public onCollisionEnter(e:CollisionEnterEventArgs){
        if(e.collision.collider.isSame(this.camCol)){
            this.enterPoint = this.camTr.getWorldPosition();
        }
    }
    
    public onCollisionExit(e:CollisionExitEventArgs){
        if(e.collision.collider.isSame(this.camCol)){
            let exitPoint = this.camTr.getWorldPosition();
            let dir:vec3 = null;

            if(!isNull(this.enterPoint)){
                dir = exitPoint.sub(this.enterPoint);
                dir = dir.normalize();
                let dot = this.tr.forward.dot(dir);
                if(this.msg.includes("start")){
                    this.pathRunner.onStartCollisionExit(dot);
                }else if(this.msg.includes("finish")){
                    this.pathRunner.onFinishCollisionExit(dot);
                }
                // Reset
                this.enterPoint = null;
            }else{
                print("WARNING: cam fwd used for collision");
            }
        }
    }
}

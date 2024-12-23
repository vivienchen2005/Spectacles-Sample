import {VoiceMLTranscribeSingleton} from "./VoiceMLTranscribeSingleton"

@component
export class VoiceMLSingletonInitializer extends BaseScriptComponent {

    @input private voiceMLModule:VoiceMLModule    
    private voiceMLTranscribeSingleton:VoiceMLTranscribeSingleton

    onAwake() {
        this.voiceMLTranscribeSingleton = VoiceMLTranscribeSingleton.getInstance()
        this.voiceMLTranscribeSingleton.init( this.voiceMLModule )
    }
}

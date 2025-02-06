@component
export class VoiceMLTranscribe extends BaseScriptComponent {

		private voiceMLOptions = VoiceML.ListeningOptions.create()
		
		@input private voiceMLModule:VoiceMLModule
		
		private listening = false
		
		private targetTextField:Text3D = null
		
		onAwake() {

			this.voiceMLModule.onListeningEnabled.add(() => {})
	
			this.voiceMLModule.onListeningUpdate.add((evt) => {
	
				if (evt.transcription.trim() == '') {
					return;
				}
					
				if(this.targetTextField) 
				{
					this.targetTextField.text = evt.transcription
				}

				print('Transcription: ' + evt.transcription);
				print('Is final Transcription: ' + evt.isFinalTranscription);            
					
			})
	
			this.voiceMLModule.onListeningError.add((evt) => {
				//print(`VoiceMLModule.onListeningError: ${evt.error}, ${evt.description}`)
			})        
				
		}
		
		startListening( newTargetTextField:Text3D )
		{
			this.targetTextField = newTargetTextField
			this.voiceMLModule.startListening(this.voiceMLOptions)
			this.listening = true			
		}
		
		stopListening( )
		{
			this.voiceMLModule.stopListening()
			this.listening = false				
		}    
		
		/*
	setListening(listening: boolean): void {
		//assert(this.initialized)
		if (this.listening === listening) return
		this.listening = listening

		if (listening) {
			print("VoiceMLModule.startListening")
			this.voiceMLModule.startListening(this.voiceMLOptions)
		} else {
			print("VoiceMLModule.stopListening")
			this.voiceMLModule.stopListening()
		}
	}

	get isInitialized(): boolean {
		return this.initialized
	}*/ 

	get isListening(): boolean {
		return this.listening
	}    
				
}

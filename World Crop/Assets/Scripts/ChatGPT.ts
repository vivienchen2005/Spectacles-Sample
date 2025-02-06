//PUT OPENAI KEY HERE!
const openAIKey = "Open AI Key goes HERE!~!";

@component
export class ChatGPT extends BaseScriptComponent {
  @input remoteServiceModule: RemoteServiceModule;

  private ImageQuality = CompressionQuality.HighQuality;
  private ImageEncoding = EncodingType.Jpg;

  onAwake() {}

makeImageRequest(imageTex: Texture, callback) {
    print("Making image request...");
    Base64.encodeTextureAsync(
      imageTex,
      (base64String) => {
        print("Image encode Success!");
        const textQuery =
          "Identify in as much detail what object is in the image but only use a maxiumum of 5 words, then separated by a comma, send a website link " +
          "that you find most relavent, if its a product, send a link for an amazon search, if its an antique maybe just a google shopping search, otherwise just " +
          "try to infer why I might be scanning based on the image context and send a link that could be useful your response should be something like this: " +
          "black wooden nutcracker,https://www.amazon.com/s?k=black+wooden+nutcracker MAKE SURE THERE IS ONLY ONE COMMA IN THE RESPONSE!";
        this.sendGPTChat(textQuery, base64String, callback);
      },
      () => {
        print("Image encoding failed!");
      },
      this.ImageQuality,
      this.ImageEncoding
    );
  }

  async sendGPTChat(
    request: string,
    image64: string,
    callback: (response: string) => void
  ) {
    const reqObj = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: request },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,` + image64,
              },
            },
          ],
        },
      ],
      max_tokens: 50,
    };

    const webRequest = new Request(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey}`,
        },
        body: JSON.stringify(reqObj),
      }
    );

    let resp = await this.remoteServiceModule.fetch(webRequest);
    if (resp.status == 200) {
      let bodyText = await resp.text();
      print("GOT: " + bodyText);
      var bodyJson = JSON.parse(bodyText);
      if (bodyJson.choices && bodyJson.choices.length > 0) {
        bodyJson.mainAnswer = bodyJson.choices[0].message.content;
        callback(bodyJson.mainAnswer);
        print(bodyJson.mainAnswer);
      }
    } else {
      print("error code: " + resp.status);
      print("MAKE SURE YOUR API KEY IS SET IN THIS SCRIPT!");
    }
  }
}

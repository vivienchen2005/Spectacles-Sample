import Event from "Scripts/Events";

// Interface representing a cat fact
interface CatFact {
  fact: string;
  length: number;
}

// Maximum length for the cat fact
const MAX_LENGTH = 93;

@component
export class FetchCatFacts extends BaseScriptComponent {
  // Remote service module for fetching data
  private remoteService: RemoteServiceModule = require("LensStudio:RemoteServiceModule");

  // URL for fetching cat facts with a maximum length
  private url = "https://catfact.ninja/fact?max_length=" + MAX_LENGTH;

  // Event triggered when a cat fact is received
  catFactReceived: Event<string>;

  // Initialize the event on awake
  onAwake() {
    this.catFactReceived = new Event<string>();
  }

  // Method to fetch cat facts
  public getCatFacts() {
    // Fetch cat fact using the remote service
    this.remoteService
      .fetch(this.url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
      .then((response) => response.json())
      .then((data) => {
        let randomCatFact = data as CatFact;
        // Invoke the event with the received cat fact
        this.catFactReceived.invoke(randomCatFact.fact);
      })
      .catch(failAsync);

    // Async function to fetch cat fact
    let asyncFunction = async () => {
      const response = await this.remoteService.fetch(this.url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      let randomCatFact = data as CatFact;
      // Invoke the event with the received cat fact
      this.catFactReceived.invoke(randomCatFact.fact);
    };
    // Execute the async function and handle errors
    asyncFunction().catch((error) => {
      print("Error: " + error);
    });
  }
}

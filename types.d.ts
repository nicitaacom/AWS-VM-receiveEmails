declare module "mimemessage" {
  interface Part {
    type: string;
    content: string;
  }

  interface Headers {
    [key: string]: string;
  }

  interface MimeMessage {
    headers: Headers;
    body: Part[];
  }

  function parse(content: string): MimeMessage;

  export { parse };
}
declare module '*?worker' {
  const value: { new (): Worker };
  export = value;
}

declare module '*?worker&inline' {
  const value: { new (): Worker };
  export = value;
}

declare module "gender-detection" {
  const genderDetection: {
    detect(name: string): "male" | "mostly_male" | "female" | "mostly_female" | "unknown";
  };
  export default genderDetection;
}

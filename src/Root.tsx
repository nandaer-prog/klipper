import { Composition } from "remotion";
import { ClipVideo } from "./ClipVideo";
import { defaultClipProps, type ClipProps } from "./types";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Clip"
      component={ClipVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS * defaultClipProps.durationInSeconds}
      defaultProps={defaultClipProps}
      calculateMetadata={({ props }: { props: ClipProps }) => ({
        durationInFrames: Math.max(
          1,
          Math.round(props.durationInSeconds * FPS),
        ),
      })}
    />
  );
};

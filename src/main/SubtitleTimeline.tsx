import React, { useEffect, useRef, useState } from "react";
import { css } from "@emotion/react";
import { SegmentsList as CuttingSegmentsList, Waveforms } from "./Timeline";
import {
  selectSelectedSubtitleByFlavor,
  selectSelectedSubtitleFlavor,
  setCueAtIndex,
  setCurrentlyAt,
  setTimelineSegmentClicked,
  setTimelineSegmentClickTriggered,
} from '../redux/subtitleSlice'
import { useDispatch, useSelector } from "react-redux";
import useResizeObserver from "use-resize-observer";
import { selectDuration } from "../redux/videoSlice";
import { RootState } from "../redux/store";
import { ActionCreatorWithPayload } from "@reduxjs/toolkit";
import Draggable from "react-draggable";
import { SubtitleCue } from "../types";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";

/**
 * Copy-paste of the timeline in Video.tsx, so that we can make some small adjustments,
 * like adding in a list of subtitle segments
 */
 const SubtitleTimeline: React.FC<{
  selectCurrentlyAt: (state: RootState) => number,
  setClickTriggered: ActionCreatorWithPayload<any, string>,
  setCurrentlyAt: ActionCreatorWithPayload<number, string>,
}> = ({
  selectCurrentlyAt,
  setClickTriggered,
  setCurrentlyAt,
}) => {

  // Init redux variables
  const dispatch = useDispatch();
  const duration = useSelector(selectDuration)
  const currentlyAt = useSelector(selectCurrentlyAt)

  const { ref, width = 1, } = useResizeObserver<HTMLDivElement>();
  const refTop = useRef<HTMLDivElement>(null);
  const { ref: refMini, width: widthMiniTimeline = 1, } = useResizeObserver<HTMLDivElement>();

  const timelineCutoutInMs = 10000    // How much of the timeline should be visible in milliseconds. Aka a specific zoom level

  const timelineStyle = css({
    position: 'relative',     // Need to set position for Draggable bounds to work
    height: '220px',
    width: ((duration / timelineCutoutInMs)) * 100 + '%',    // Total length of timeline based on number of cutouts
    paddingLeft: '50%',
    paddingRight: '50%',
  });

  const setCurrentlyAtToClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    let rect = e.currentTarget.getBoundingClientRect()
    let offsetX = e.clientX - rect.left
    dispatch(setClickTriggered(true))
    dispatch(setCurrentlyAt((offsetX / widthMiniTimeline) * (duration)))
  }

  // Apply horizonal scrolling when scrolled from somewhere else
  useEffect(() => {
    if (currentlyAt !== undefined && refTop.current) {
      const scrollLeftMax = (refTop.current.scrollWidth - refTop.current.clientWidth)
      refTop.current.scrollTo(((currentlyAt / duration)) * scrollLeftMax, 0)
    }
  }, [currentlyAt, duration, width]);

  // draws a triangle on top of the middle line
  const triangleStyle = css({
    width: 0,
    height: 0,
    left: '-19px',
    borderLeft: '20px solid transparent',
    borderRight: '20px solid transparent',
    position: "relative",
    borderTop: '20px solid black',
  })

  return (
    <div css={{position: 'relative', width: '100%', height: '230px'}}>
      {/* Sits smack dab in the middle and does not move */}
      <div
        css={{position: 'absolute',
        width: '2px',
        height: '190px',
        ...(refTop.current) && {left: (refTop.current.clientWidth / 2)},
        top: '10px',
        background: 'black'}}>
          <div css={triangleStyle} />
      </div>
      {/* Scrollable timeline */}
      {/* Container. Has width of parent*/}
      <div ref={refTop} css={{overflow: 'hidden', width: '100%', height: '100%'}}>
        {/* Container. Overflows. Width based on parent times zoom level*/}
        <div ref={ref} css={timelineStyle} title="Timeline" >
          <div css={{height: '10px'}} />    {/* Fake padding. TODO: Figure out a better way to pad absolutely positioned elements*/}
          <TimelineSubtitleSegmentsList timelineWidth={width}/>
          <div css={{position: 'relative', height: '100px'}} >
            <Waveforms />
            <CuttingSegmentsList timelineWidth={width}/>
          </div>
        </div>
      </div>
      {/* Mini Timeline. Makes it easier to understand position in scrollable timeline */}
      <div
        title="Mini Timeline"
        onMouseDown={e => setCurrentlyAtToClick(e)}
        css={{position: 'relative', width: '100%', height: '15px', background: 'lightgrey'}}
        ref={refMini}
      >
        <div
          css={{position: 'absolute', width: '2px', height: '100%', left: (currentlyAt / duration) * (widthMiniTimeline), top: 0, background: 'black'}}
        >
        </div>
      </div>
    </div>



    // <div className="layoutRoot absoluteLayout">
    //   {/* <Example /> */}
    //   <Example2 />
    //   {/* <TimelineSubtitleSegment
    //   timelineWidth={width}
    //   cue={{id: '42', text:"HI", startTime: 1000, endTime: 5000, tree:{children: [{type: "", value: ""}]}}}
    //   index={0}
    //   height={80}
    //   /> */}
    // </div>
  );
};


/**
 * Displays subtitle segments as a row of boxes
 */
const TimelineSubtitleSegmentsList: React.FC<{timelineWidth: number}> = ({timelineWidth}) => {

  const arbitraryHeight = 80
  const subtitle = useSelector(selectSelectedSubtitleByFlavor)

  const segmentsListStyle = css({
    position: 'relative',
    width: '100%',
    height: `${arbitraryHeight}px`,
    overflow: 'hidden',
  })

  return (
    <div css={segmentsListStyle}>
      {subtitle?.map((item, i) => {
        return (
          <TimelineSubtitleSegment timelineWidth={timelineWidth} cue={item} height={arbitraryHeight} key={item.id} index={i}/>
        )
      })}
    </div>
  );

}

/**
 * A single segments for the timeline subtitle segments list
 */
const TimelineSubtitleSegment: React.FC<{
  timelineWidth: number,
  cue: SubtitleCue,
  index: number,
  height: number
}> = React.memo(props => {

  // Redux
  const dispatch = useDispatch()
  const selectedFlavor = useSelector(selectSelectedSubtitleFlavor)
  const duration = useSelector(selectDuration)

  // Dimensions and position offsets in px. Required for resizing
  const [absoluteWidth, setAbsoluteWidth] = useState(0)
  const [absoluteHeight, setAbsoluteHeight] = useState(0)
  const [absoluteLeft, setAbsoluteLeft] = useState(0)
  const [absoluteTop, setAbsoluteTop] = useState(0)

  const [controlledPosition, setControlledPosition] = useState({x: 0, y: 0})
  const [isGrabbed, setIsGrabbed] = useState(false)
  const nodeRef = React.useRef(null); // For supressing "ReactDOM.findDOMNode() is deprecated" warning

  // Reposition scrubber when the current x position was changed externally
  useEffect(() => {
    setControlledPosition({x: (props.cue.startTime / duration) * (props.timelineWidth), y: 0});
  },[props.cue.startTime, duration, props.timelineWidth])

  // Set width and reset any resizing that may have happened meanwhile
  useEffect(() => {
    setAbsoluteWidth(((props.cue.endTime - props.cue.startTime) / duration) * props.timelineWidth)
    setAbsoluteHeight(props.height)
    setAbsoluteLeft(0)
    setAbsoluteTop(0)
  },[duration, props.cue.endTime, props.cue.startTime, props.height, props.timelineWidth])

  // Check for impossible timestamps and update state in redux
  const dispatchNewTimes = (newStartTime: number, newEndTime: number) => {
    if (newStartTime < 0) {
      newStartTime = 0
    }
    if (newEndTime < newStartTime) {
      newEndTime = newStartTime
    }

    dispatch(setCueAtIndex({
      identifier: selectedFlavor,
      cueIndex: props.index,
      newCue: {
        id: props.cue.id,
        text: props.cue.text,
        startTime: newStartTime,
        endTime: newEndTime,
        tree: props.cue.tree
      }
    }))
  }

  // Resizable does not support resizing in the west/north directions out of the box,
  // so additional calculations are necessary.
  // Adapted from Resizable example code
  const onResizeAbsolute = (event: any, {element, size, handle}: any) => {
    // Possible TODO: Find a way to stop resizing a segment beyond 0ms here instead of later
    let newLeft = absoluteLeft;
    let newTop = absoluteTop;
    const deltaHeight = size.height - absoluteHeight;
    const deltaWidth = size.width - absoluteWidth;
    if (handle[0] === 'n') {
      newTop -= deltaHeight;
    } else if (handle[0] === 's') {
      newTop += deltaHeight;
    }
    if (handle[handle.length - 1] === 'w') {
      newLeft -= deltaWidth;
    } else if (handle[handle.length - 1] === 'e') {
      newLeft += deltaWidth;
    }

    setAbsoluteWidth(size.width)
    setAbsoluteHeight(size.height)
    setAbsoluteLeft(newLeft)
    setAbsoluteTop(newTop)
  };

  // Update redux state based on the resize
  const onResizeStop = (event: any, {element, size, handle}: any) => {
    // Calc new width, factoring in offset
    const newWidth = absoluteWidth

    const newSegmentDuration = (newWidth / props.timelineWidth) * duration
    const timeDiff = (props.cue.endTime - props.cue.startTime) - newSegmentDuration

    let newStartTime = props.cue.startTime
    let newEndTime = props.cue.endTime
    // if handle === left, update startTime
    if (handle === 'w') {
      newStartTime = props.cue.startTime + timeDiff
    }
    // if handle === right, update endTime
    if (handle === 'e') {
      newEndTime = props.cue.endTime + timeDiff
    }

    dispatchNewTimes(newStartTime, newEndTime)

    // Reset resizing
    // Required when resizing beyond 0 multiple times,
    // because the time does not change, so the reset in useEffect does not trigger
    setAbsoluteWidth(((props.cue.endTime - props.cue.startTime) / duration) * props.timelineWidth)
    setAbsoluteHeight(props.height)
    setAbsoluteLeft(0)
    setAbsoluteTop(0)
  }

  const onStartDrag = () => {
    setIsGrabbed(true)
  }

  const onStopDrag = (e: any, position: any) => {
    // Update position and thereby start/end times in redux
    const {x} = position
    dispatchNewTimes(
      (x / props.timelineWidth) * (duration),
      (x / props.timelineWidth) * (duration) + (props.cue.endTime - props.cue.startTime)
    )

    setIsGrabbed(false)
  }

  const onClick = () => {
    // Scroll to segment start
    dispatch(setCurrentlyAt(props.cue.startTime))

    // Inform list view which segment was clicked
    dispatch(setTimelineSegmentClickTriggered(true))
    dispatch(setTimelineSegmentClicked(props.cue.id))
  }

  const segmentStyle = css({
    position: 'absolute',

    // Apply resizable calculations
    width: absoluteWidth,
    height: absoluteHeight,
    margin: `${absoluteTop}px 0px 0px ${absoluteLeft}px`,

    background: 'rgba(0, 0, 0, 0.4)',
    borderRadius: '5px',
    borderStyle: 'solid',
    borderColor: 'dark-grey',
    borderWidth: '1px',
    boxSizing: 'border-box',
    zIndex: 1,

    cursor: isGrabbed ? "grabbing" : "grab",

    // Center text
    display: 'flex',
    alignItems: 'center',
  })

  const textStyle = css({
    overflow: 'hidden',
    whiteSpace: "nowrap",
    textOverflow: 'ellipsis',
    padding: '8px',
    color: 'white',
  })

  return (
    <div>
      <Draggable
        onStart={onStartDrag}
        onStop={onStopDrag}
        defaultPosition={{ x: 10, y: 10 }}
        position={controlledPosition}
        axis="x"
        bounds="parent"
        nodeRef={nodeRef}
        cancel={".react-resizable-handle"}
      >
        <Resizable
          height={absoluteHeight}
          width={absoluteWidth}
          onResize={onResizeAbsolute}
          onResizeStop={onResizeStop}
          // TODO: The 'e' handle is currently NOT WORKING CORRECTLY!
          //  The errounous behaviour can already be seens with a minimal
          //  draggable + resizable example.
          //  Fix most likely requires changes in one of those modules
          resizeHandles={['w']}
        >
          <div css={ segmentStyle } ref={nodeRef} onClick={onClick}>
            <span css={textStyle}>{props.cue.text}</span>
          </div>
        </Resizable>
      </Draggable>
    </div>
  )
})

// /**
//  * For debugging
//  * Minimal example: Resizable
//  */
//  const Example: React.FC<{}> = () => {

//   const [absoluteWidth, setAbsoluteWidth] = useState(200)
//   const [absoluteHeight, setAbsoluteHeight] = useState(200)
//   const [absoluteLeft, setAbsoluteLeft] = useState(0)
//   const [absoluteTop, setAbsoluteTop] = useState(0)

//   // On bottom layout. Used to resize the center element around its flex parent.
//   const onResizeAbsolute = (event: any, {element, size, handle}: any) => {
//     let newLeft = absoluteLeft;
//     let newTop = absoluteTop;
//     const deltaHeight = size.height - absoluteHeight;
//     const deltaWidth = size.width - absoluteWidth;
//     if (handle[0] === 'n') {
//       newTop -= deltaHeight;
//     } else if (handle[0] === 's') {
//       newTop += deltaHeight;
//     }
//     if (handle[handle.length - 1] === 'w') {
//       newLeft -= deltaWidth;
//     } else if (handle[handle.length - 1] === 'e') {
//       newLeft += deltaWidth;
//     }

//     setAbsoluteWidth(size.width)
//     setAbsoluteHeight(size.height)
//     setAbsoluteLeft(newLeft)
//     setAbsoluteTop(newTop)
//   };

//   return (
//     <Resizable
//       // className="box absolutely-positioned center-aligned"
//       height={absoluteHeight}
//       width={absoluteWidth}
//       onResize={onResizeAbsolute}
//       resizeHandles={['sw', 'se', 'nw', 'ne', 'w', 'e', 'n', 's']}
//     >
//       <div
//         // className="box"
//         style={{
//           width: absoluteWidth,
//           height: absoluteHeight,
//           margin: `${absoluteTop}px 0px 0px ${absoluteLeft}px`,
//         }}
//       >
//         <span className="text">{"Raw use of <Resizable> element with controlled position. Resize and reposition in all directions" + absoluteLeft}</span>
//       </div>
//     </Resizable>
//   );
// }

// /**
//  * For debugging
//  * Minimal example: Draggable + Resizable
//  * Erratic behaviour when resizing the east handle for smallish widths
//  */
// const Example2: React.FC<{}> = () => {

//   const [absoluteWidth, setAbsoluteWidth] = useState(200)
//   const [absoluteHeight, setAbsoluteHeight] = useState(200)
//   const [absoluteLeft, setAbsoluteLeft] = useState(0)
//   const [absoluteTop, setAbsoluteTop] = useState(0)

//   // On bottom layout. Used to resize the center element around its flex parent.
//   const onResizeAbsolute = (event: any, {element, size, handle}: any) => {
//     let newLeft = absoluteLeft;
//     let newTop = absoluteTop;
//     const deltaHeight = size.height - absoluteHeight;
//     const deltaWidth = size.width - absoluteWidth;
//     if (handle[0] === 'n') {
//       newTop -= deltaHeight;
//     } else if (handle[0] === 's') {
//       newTop += deltaHeight;
//     }
//     if (handle[handle.length - 1] === 'w') {
//       newLeft -= deltaWidth;
//     } else if (handle[handle.length - 1] === 'e') {
//       newLeft += deltaWidth;
//     }

//     setAbsoluteWidth(size.width)
//     setAbsoluteHeight(size.height)
//     setAbsoluteLeft(newLeft)
//     setAbsoluteTop(newTop)
//   };

//   const leStyle = {
//     width: absoluteWidth,
//     height: absoluteHeight,
//     margin: `${absoluteTop}px 0px 0px ${absoluteLeft}px`,
//     backgroundColor: "red",
//   }

//   return (
//     <div>
//       <Draggable
//         defaultPosition={{ x: 10, y: 10 }}
//         onDrag={() => console.log("onDrag")}
//         cancel={".react-resizable-handle"}
//       >
//         <Resizable
//           height={absoluteHeight}
//           width={absoluteWidth}
//           onResize={onResizeAbsolute}
//           resizeHandles={['sw', 'se', 'nw', 'ne', 'w', 'e', 'n', 's']}
//         >
//           <div style={ leStyle }>
//             test
//           </div>
//         </Resizable>
//       </Draggable>
//     </div>
//   )
// }

export default SubtitleTimeline

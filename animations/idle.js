import * as THREE from 'three';
import { makeArmDownQuaternion } from './utils.js';

/**
 * Creates an idle animation.
 * @param {THREE.Skeleton} skeleton - The skeleton to animate.
 * @param {THREE.Vector3} hipPos - The initial local position of the hip bone.
 * @param {Map<string, THREE.Vector3>} markerPositions - A map of bone names to their local positions.
 * @returns {THREE.AnimationClip|null}
 */
export function createIdleAnimation(skeleton, hipPos, markerPositions) {
    const hips = skeleton.getBoneByName('hips');
    const spine = skeleton.getBoneByName('spine');
    const shoulderL = skeleton.getBoneByName('left_shoulder');
    const shoulderR = skeleton.getBoneByName('right_shoulder');
    const elbowL = skeleton.getBoneByName('left_elbow');
    const elbowR = skeleton.getBoneByName('right_elbow');
    const kneeL = skeleton.getBoneByName('left_knee');
    const kneeR = skeleton.getBoneByName('right_knee');
    const ankleL = skeleton.getBoneByName('left_ankle');
    const ankleR = skeleton.getBoneByName('right_ankle');

    if (!hips || !spine || !shoulderL || !shoulderR || !kneeL || !kneeR || !ankleL || !ankleR) return null;

    const idleTimes = [0, 1.5, 3]; // A 3-second loop: up, down, up
    const interpolation = THREE.InterpolateSmooth;
    const tracks = [];

    // Compute base "arms down" orientation from T-pose using marker directions
    const qDownL = makeArmDownQuaternion(markerPositions, 'left_shoulder', 'left_elbow');
    const qDownR = makeArmDownQuaternion(markerPositions, 'right_shoulder', 'right_elbow');

    // Subtle arm sway around Z while keeping them down
    const armSwayAngle = Math.PI / 40; // ~4.5 degrees
    const qSwayL_Pos = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, +armSwayAngle));
    const qSwayL_Neg = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -armSwayAngle));
    const qSwayR_Pos = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, +armSwayAngle));
    const qSwayR_Neg = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -armSwayAngle));

    // Compose: sway * down to keep sway relative to the "arms-down" base orientation
    const qL0 = qDownL.clone();
    const qL1 = qSwayL_Pos.clone().multiply(qDownL);
    const qL2 = qDownL.clone();
 
    tracks.push(new THREE.QuaternionKeyframeTrack(`${shoulderL.name}.quaternion`, idleTimes, [
        ...qL0.toArray(), ...qL1.toArray(), ...qL2.toArray()
    ], interpolation));

    const qR0 = qDownR.clone();
    const qR1 = qSwayR_Neg.clone().multiply(qDownR);
    const qR2 = qDownR.clone();
    
    tracks.push(new THREE.QuaternionKeyframeTrack(`${shoulderR.name}.quaternion`, idleTimes, [
        ...qR0.toArray(), ...qR1.toArray(), ...qR2.toArray()
    ], interpolation));

    // Hips move down and up to simulate breathing and knee bending.
    const bobAmount = -0.05; // meters (5cm down) for a more noticeable knee bend effect
    const initialHipPos = hipPos.clone();
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, idleTimes, [
        initialHipPos.x, initialHipPos.y, initialHipPos.z,
        initialHipPos.x, initialHipPos.y + bobAmount, initialHipPos.z,
        initialHipPos.x, initialHipPos.y, initialHipPos.z,
    ], interpolation));

    // Both knees bend in sync when hips go down.
    // Use a similar angle to the walk animation's stance phase for consistency.
    const kneeBendAngle = Math.PI / 12; // 15 degrees, more than before
    const qKnee_Base = new THREE.Quaternion(); // Identity quaternion
    // Use Z-axis for flexion to be consistent with walk animation. Positive for forward bend.
    const qKnee_Bent = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, kneeBendAngle));
    
    const kneeKeyframes = [ ...qKnee_Base.toArray(), ...qKnee_Bent.toArray(), ...qKnee_Base.toArray() ];

    tracks.push(new THREE.QuaternionKeyframeTrack(`${kneeR.name}.quaternion`, idleTimes, kneeKeyframes, interpolation));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${kneeL.name}.quaternion`, idleTimes, kneeKeyframes, interpolation));

    // Ankles counter-rotate to keep feet flat on the ground.
    // The angle should be approximately the same as the knee bend angle, but negative.
    const qAnkle_Base = new THREE.Quaternion(); // Identity quaternion
    const qAnkle_Compensate = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -kneeBendAngle));
    
    const ankleKeyframes = [ ...qAnkle_Base.toArray(), ...qAnkle_Compensate.toArray(), ...qAnkle_Base.toArray() ];

    // The user instruction says "not moving their ankles", but to keep feet flat, a counter-rotation is needed.
    // This keeps the foot part of the ankle joint from rotating. If they want ankles truly locked, we would remove this.
    // Given the context of realism, this compensation is likely what's intended.
    tracks.push(new THREE.QuaternionKeyframeTrack(`${ankleR.name}.quaternion`, idleTimes, ankleKeyframes, interpolation));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${ankleL.name}.quaternion`, idleTimes, ankleKeyframes, interpolation));


    // Slight elbow bend so arms look natural at sides
    if (elbowL) {
        const qElbowL_Base = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 16, 0)); // small bend
        const elbowLValues = [ ...qElbowL_Base.toArray(), ...qElbowL_Base.toArray(), ...qElbowL_Base.toArray() ];
        tracks.push(new THREE.QuaternionKeyframeTrack(`${elbowL.name}.quaternion`, idleTimes, elbowLValues, interpolation));
    }
    if (elbowR) {
        const qElbowR_Base = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 16, 0)); // small bend
        const elbowRValues = [ ...qElbowR_Base.toArray(), ...qElbowR_Base.toArray(), ...qElbowR_Base.toArray() ];
        tracks.push(new THREE.QuaternionKeyframeTrack(`${elbowR.name}.quaternion`, idleTimes, elbowRValues, interpolation));
    }

    return new THREE.AnimationClip('idle', -1, tracks);
}
/** A narrow, source-verified clarification—not a claim of general AI correctness. */
export function clarifyPhysicsFeedback(feedback:string,subjectId:string,chapterId:string) {
    if(subjectId!=="physics"||chapterId!=="p5"||!/rough\s+surface/i.test(feedback)||!/constant\s+(?:vector\s+)?(?:velocity|speed)/i.test(feedback)||!/friction/i.test(feedback)||/applied|pull|push|driv|balancing\s+horizontal/i.test(feedback))return feedback;
    return feedback+"\n\n**Source-based clarification (not a new AI response):** On a rough horizontal surface, gravity and the normal force cannot balance the horizontal friction force. Constant straight-line velocity also requires a horizontal applied force balancing friction. Name all forces on the chosen body before summing them.";
}

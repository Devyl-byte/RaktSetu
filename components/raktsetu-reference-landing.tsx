"use client";

import gsap from "gsap";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, Bell, Check, ChevronLeft, ChevronRight, CircleCheck, Droplet, Fingerprint, Heart, HeartPulse, Hospital, LayoutDashboard, LockKeyhole, MapPin, MousePointer2, Pause, Play, RotateCcw, ShieldCheck, Signal, UserRound, Users, Wifi } from "lucide-react";
import { focusFirstInvalidField, validationClass } from "@/lib/form-validation";

type RaktSetuReferenceLandingProps = {
  onRegister: () => void;
  onSignIn: () => void;
  onStaff: () => void;
};

function RequiredWalkthroughLabel({ children }: { children: string }) {
  return <span className="field-label">{children} <span className="required-mark" aria-hidden="true">*</span></span>;
}

const steps = [
  { label: "Register", title: "A small first step.\nA life-changing journey.", body: "A donor creates an account with a mobile number and basic details. This becomes their private connection to participating blood centres.", actor: "Donor", action: "Create account", result: "Account created. Mobile verification comes next.", screen: "Create your account", note: "Your contact details stay private during account setup." },
  { label: "Verify mobile", title: "A real number.\nA trusted connection.", body: "A one-time code confirms control of the mobile number used for donor coordination. The MVP accepts any entered code so the complete journey can be tested.", actor: "Donor + system", action: "Verify mobile", result: "Mobile verified. Identity verification can now begin.", screen: "Verify your mobile", note: "Preview access: enter any one-time code." },
  { label: "Verify identity", title: "One person.\nOne verified record.", body: "With consent, an approved digital identity service connects one donor record across participating hospitals. First-time donors may be contacted before a physical verification; the blood centre performs that check at the first visit.", actor: "Approved identity service", action: "Verify identity", result: "One network identity has been established for this preview account.", screen: "Identity verification", note: "No Aadhaar number is collected in this preview." },
  { label: "Build profile", title: "The right details\nmake the right match.", body: "Blood group, approximate area, a one-time previous-donation declaration, donation-method willingness and notification choices help hospitals send relevant requests.", actor: "Donor", action: "Save profile", result: "Profile and initial history declaration saved.", screen: "Your donor profile", note: "Blood group remains self-declared until verified by a blood centre." },
  { label: "Availability", title: "Contactable today.\nScreened at the centre.", body: "The platform checks connected donation and deferral records, the one-time declaration when no connected record exists, and whether the donor is open to requests. Final eligibility remains with the blood centre.", actor: "Matching service", action: "Check readiness", result: "Potentially contactable. Hospital screening is still required.", screen: "Contact readiness", note: "This controls outreach—not medical eligibility." },
  { label: "Receive request", title: "A governed request.\nA chance to help.", body: "A hospital request reaches donors only after maker-checker approval and server-enforced outreach limits. Matching then uses group, donation method, contact readiness and approximate area.", actor: "Hospital + system", action: "View request", result: "An approved, relevant request is ready for your response.", screen: "A request near you", note: "Emergency outreach exceptions require a documented district decision." },
  { label: "Respond", title: "Your choice.\nYour consent.", body: "Accepting places the donor in a first-come response queue. Declining closes the invitation without requiring a medical explanation.", actor: "Donor", action: "Accept request", result: "Response accepted. Wait for hospital confirmation before travelling.", screen: "Respond to request", note: "Accepting is not an instruction to travel." },
  { label: "Travel confirmed", title: "Wait at home.\nTravel when confirmed.", body: "The blood centre confirms only the donors currently required. Selected donors receive the reporting window and destination; everyone else stays informed.", actor: "Authorized hospital staff", action: "Confirm travel", result: "Travel confirmed. Reporting instructions are now available.", screen: "Hospital confirmation", note: "Confirmation authorizes a visit for screening—not donation eligibility." },
  { label: "Screen & donate", title: "A human check\nbefore every donation.", body: "The blood centre verifies identity, reviews history, performs clinical screening and records the authorized outcome—even when the donor is deferred, collection is interrupted or a collected unit cannot be used.", actor: "Licensed blood centre", action: "Record outcome", result: "The hospital visit and authorized outcome have been recorded.", screen: "Hospital outcome", note: "The hospital—not RaktSetu—makes the medical decision." },
  { label: "Close the loop", title: "One outcome.\nEveryone informed.", body: "The hospital record updates connected donation history and the applicable contact interval. The request closes and every donor still waiting receives the correct update.", actor: "Hospital + system", action: "View record", result: "Journey complete. The request and all donor branches are safely closed.", screen: "Connected record", note: "Sensitive clinical details remain role-restricted." },
];

function LocalMap() {
  return <div className="local-map" aria-label="Illustrated route to sample hospital, 4.8 kilometres"><svg viewBox="0 0 440 230" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="440" height="230" fill="#edf1eb"/><path d="M330 -20 Q210 80 330 140 T290 260" stroke="#b7d9dd" strokeWidth="35" fill="none"/><g fill="#dde5d8"><rect x="25" y="25" width="70" height="45" rx="5"/><rect x="145" y="35" width="65" height="45" rx="5"/><rect x="40" y="150" width="55" height="50" rx="5"/><rect x="170" y="140" width="70" height="55" rx="5"/><rect x="365" y="70" width="65" height="65" rx="5"/></g><path d="M0 110 L440 110 M120 0 L120 230 M0 210 L440 20 M360 0 L360 230" stroke="white" strokeWidth="16"/><path d="M70 155 L120 133 L120 110 L285 110 L335 87" stroke="#b71335" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="70" cy="155" r="9" fill="#177a68" stroke="white" strokeWidth="4"/><circle cx="335" cy="87" r="11" fill="#b71335" stroke="white" strokeWidth="4"/><text x="40" y="184" fill="#33443d" fontSize="12">You</text><text x="290" y="60" fill="#33443d" fontSize="12">City Hospital</text></svg><span><MapPin size={13}/> 4.8 km away</span></div>;
}

export function RaktSetuReferenceLanding({ onRegister, onSignIn, onStaff }: RaktSetuReferenceLandingProps) {
  const root = useRef<HTMLElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [available, setAvailable] = useState(true);
  const [hospitalConfirmed, setHospitalConfirmed] = useState(false);
  const [outcomeRecorded, setOutcomeRecorded] = useState(false);
  const [group, setGroup] = useState("B+");
  const [component, setComponent] = useState("Whole blood");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [declined, setDeclined] = useState(false);
  const [reduced, setReduced] = useState(false);
  const walkthroughFormRef = useRef<HTMLFormElement>(null);
  const step = steps[index];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setReduced(media.matches);
      if(media.matches) setPlaying(false);
    });
    const change = () => { setReduced(media.matches); if(media.matches) setPlaying(false); };
    media.addEventListener("change",change); return ()=>{active=false;media.removeEventListener("change",change);};
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({paused:true}); timeline.current=tl;
      gsap.fromTo(".screen-scene",{opacity:0,y:reduced?0:16},{opacity:1,y:0,duration:reduced?0:.55,ease:"power3.out"});
      gsap.fromTo(".story-copy > *",{opacity:0,y:reduced?0:12},{opacity:1,y:0,stagger:reduced?0:.09,duration:reduced?0:.5});
      if (!reduced && index === 0) {
        Array.from("Aarav Sharma").forEach((_, n) => tl.call(() => setName("Aarav Sharma".slice(0, n + 1)), [], .5 + n * .055));
        Array.from("9876543210").forEach((_, n) => tl.call(() => setMobile("9876543210".slice(0, n + 1)), [], 1.05 + n * .055));
      }
      if (!reduced && index === 1) {
        Array.from("246810").forEach((_, n) => tl.call(() => setOtp("246810".slice(0, n + 1)), [], .8 + n * .12));
      }
      tl.fromTo(".play-progress",{scaleX:0},{scaleX:1,ease:"none",duration:8},0)
        .call(()=>{setPhase(1);if(index===0){setName("Aarav Sharma");setMobile("9876543210");}if(index===1)setOtp("246810");if(index===2||index===6)setConsent(true);if(index===4)setAvailable(true);if(index===7||index===8)setHospitalConfirmed(true);},[],1.7)
        .fromTo(".demo-cursor",{opacity:0,x:30,y:30},{opacity:reduced?0:1,x:0,y:0,duration:.7,ease:"power2.out"},2.4)
        .to(".primary-action",{scale:reduced?1:.97,duration:.16,repeat:1,yoyo:true},3.5)
        .call(()=>{setPhase(2);if(index===8)setOutcomeRecorded(true);},[],3.8)
        .to(".demo-cursor",{opacity:0,duration:.2},4)
        .call(()=>{if(index<9)jump(index+1);else setPlaying(false);},[],8);
    },root);
    return ()=>{timeline.current=null;ctx.revert();};
  },[index,reduced]);
  useEffect(()=>{timeline.current?.timeScale(speed);if(playing)timeline.current?.play();else timeline.current?.pause();},[playing,speed,index,reduced]);
  useEffect(()=>{const node=root.current?.querySelector<HTMLElement>(`[data-step="${index}"]`); const scroll=root.current?.querySelector(".flow-scroll"); if(node&&scroll)scroll.scrollTo({left:node.offsetLeft-scroll.clientWidth/2+node.clientWidth/2,behavior:reduced?"auto":"smooth"});},[index,reduced]);

  function takeControl(){timeline.current?.pause();setPlaying(false);setManual(true);setPhase(1);setError("");}
  function jump(next:number){
    const target=Math.max(0,Math.min(9,next));
    setPhase(0);setError("");setDeclined(false);setManual(false);
    setSubmitted(false);setTouched(new Set());
    setConsent(false);setHospitalConfirmed(false);setOutcomeRecorded(false);
    if(target===0){setName("");setMobile("");}if(target===1)setOtp("");
    setIndex(target);
  }
  function replay(){jump(0);setPlaying(true);if(index===0)timeline.current?.restart();}
  function togglePlay(){if(playing){setPlaying(false);return;}setManual(false);setError("");setDeclined(false);if(index===9&&phase===2){replay();return;}if(manual)timeline.current?.restart();setPlaying(true);}
  function touch(name:string){setTouched(current=>new Set(current).add(name));}
  function fail(message:string){setSubmitted(true);setError(message);focusFirstInvalidField(walkthroughFormRef.current);}
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    takeControl();
    if(index===0&&name.trim().length<2)return fail("Enter your full name to continue.");
    if(index===0&&!/^[6-9]\d{9}$/.test(mobile))return fail("Enter a valid 10-digit sample mobile number.");
    if(index===1&&!otp.trim())return fail("Enter any one-time code to continue this preview.");
    if((index===2||index===6)&&!consent)return fail("Your consent is needed before continuing.");
    if(index===4&&!available)return fail("Matching is paused. Turn availability on to receive requests.");
    if(index===7&&!hospitalConfirmed)return fail("Hospital staff must confirm that this donor should travel for screening.");
    if(index===8&&(!hospitalConfirmed||!outcomeRecorded))return fail("Authorized blood-centre staff must record both the visit and its outcome.");
    setSubmitted(false);
    setPhase(2);setDeclined(false);
  }
  const success=phase===2;
  const toggle=(setter:(value:boolean)=>void,value:boolean)=>{takeControl();setter(value);};

  return <main className="raktsetu-reference" ref={root}>
    <header className="site-header"><button className="brand" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} type="button" aria-label="RaktSetu home"><Droplet size={25} fill="currentColor"/>RaktSetu<span className="brand-divider"/><small>DONOR JOURNEY</small></button><span className="header-note"><span className="status-dot"/> A little of you. A lifetime for someone.</span><span className="header-access"><button className="staff-access-button" onClick={onStaff} type="button"><Hospital size={13}/><span className="staff-label-full">Hospital / District Login</span><span className="staff-label-short">Institutions</span></button><button onClick={onSignIn} type="button"><span className="donor-label-full">Donor sign in</span><span className="donor-label-short">Sign in</span></button><button className="demo-label" onClick={onRegister} type="button">JOIN AS DONOR</button></span></header>
    <section className="journey-heading"><div><p className="eyebrow">THE DONOR EXPERIENCE</p><h1>From your first hello<br/>to someone&apos;s second chance.</h1></div><div className="heading-meta"><span><Heart size={17}/> Every donation connects lives</span><p>10 moments. One complete journey.</p></div></section>
    <nav className="flow-scroll" id="help" aria-label="Donor journey steps"><div className="flow-track">{steps.map((s,n)=><button key={s.label} data-step={n} className={`flow-step ${n===index?"current":""} ${n<index?"visited":""}`} aria-current={n===index?"step":undefined} onClick={()=>jump(n)}><span className="step-circle">{n<index?<Check size={14}/>:String(n+1).padStart(2,"0")}</span><span>{s.label}</span>{n<9&&<ChevronRight className="flow-arrow" size={13}/>}</button>)}</div></nav>
    <section className="experience"><div className="device-area"><div className="device-overline"><span><span className="status-dot"/>{playing?"LIVE WALKTHROUGH":manual?"YOU ARE IN CONTROL":"WALKTHROUGH PAUSED"}</span><span>RaktSetu donor app</span></div>
      <div className="device"><div className="device-camera"/><div className="device-screen"><div className="device-status"><span>9:41</span><span><Signal size={12}/><Wifi size={12}/><span className="battery"/></span></div><div className="app-layout"><aside className="app-sidebar"><span className="app-logo"><Droplet size={21} fill="currentColor"/></span>{[{icon:LayoutDashboard,label:"Registration",n:0},{icon:ShieldCheck,label:"Identity",n:2},{icon:HeartPulse,label:"Availability",n:4},{icon:Bell,label:"Requests",n:5},{icon:CircleCheck,label:"Record",n:9}].map(({icon:Icon,label,n})=><button key={label} title={label} aria-label={label} className={index===n?"selected":""} onClick={()=>{setPlaying(false);jump(n);}}><Icon size={19}/></button>)}<span className="sidebar-avatar">AS</span></aside>
      <div className="app-main"><header className="app-header"><div><span>RaktSetu</span><small>DONOR PORTAL</small></div><span className="app-profile"><span className="status-dot"/> Aarav S. <span className="avatar">AS</span></span></header>
      <div className="screen-scene" key={index}><div className="screen-title"><div><span className="screen-kicker">{index<4?"ACCOUNT SETUP":index<9?"DONATION JOURNEY":"DONOR DASHBOARD"}</span><h2>{step.screen}</h2></div><span className="screen-count">{String(index+1).padStart(2,"0")} / 10</span></div><div className="screen-body"><form className="form-pane" noValidate onSubmit={submit} ref={walkthroughFormRef}>
        {index===0&&<><label className={validationClass(Boolean(name.trim()),name.trim().length>=2,touched.has("name"),submitted)}><RequiredWalkthroughLabel>Full name</RequiredWalkthroughLabel><input aria-invalid={name.trim().length<2&&(touched.has("name")||submitted)} aria-label="Full name" onBlur={()=>touch("name")} placeholder="Your full name" required value={name} onChange={e=>{takeControl();touch("name");setName(e.target.value);}}/><small className="field-feedback">{name.trim().length>=2?"Name entered correctly.":"Enter at least two characters."}</small></label><label className={validationClass(Boolean(mobile),/^[6-9]\d{9}$/.test(mobile),touched.has("mobile"),submitted)}><RequiredWalkthroughLabel>Mobile number</RequiredWalkthroughLabel><div className="phone-input"><span>+91</span><input aria-invalid={!/^[6-9]\d{9}$/.test(mobile)&&(touched.has("mobile")||submitted)} aria-label="Mobile number" inputMode="numeric" maxLength={10} onBlur={()=>touch("mobile")} pattern="[6-9][0-9]{9}" placeholder="10-digit mobile number" required value={mobile} onChange={e=>{takeControl();touch("mobile");setMobile(e.target.value.replace(/[^0-9]/g,"").slice(0,10));}}/></div><small className="field-feedback">{/^[6-9]\d{9}$/.test(mobile)?"Mobile number format is correct.":"Enter 10 digits beginning with 6, 7, 8 or 9."}</small></label><span className="subtle"><LockKeyhole size={12}/> Your contact details are private</span></>}
        {index===1&&<><p className="field-description">Code sent to +91 {mobile||"9876543210"}</p><label className={validationClass(Boolean(otp.trim()),Boolean(otp.trim()),touched.has("otp"),submitted)}><RequiredWalkthroughLabel>One-time verification code</RequiredWalkthroughLabel><input aria-invalid={!otp.trim()&&(touched.has("otp")||submitted)} className="otp-input" aria-label="Verification code" inputMode="numeric" maxLength={6} onBlur={()=>touch("otp")} placeholder="Enter any code" required value={otp} onChange={e=>{takeControl();touch("otp");setOtp(e.target.value.replace(/[^0-9]/g,"").slice(0,6));}}/><small className="field-feedback">{otp.trim()?"Code entered. You can continue.":"Enter any code for this walkthrough."}</small></label><div className="sample-code">Preview access <strong>Any value continues</strong></div></>}
        {index===2&&<><div className="identity-document"><Fingerprint size={33}/><div><strong>Aarav Sharma</strong><span>Sample digital identity / DOB 14 May 1998</span></div><ShieldCheck size={19}/></div><label className={`check-label ${validationClass(consent,consent,touched.has("consent"),submitted)}`}><input aria-invalid={!consent&&(touched.has("consent")||submitted)} type="checkbox" checked={consent} onChange={e=>{touch("consent");toggle(setConsent,e.target.checked);}} required/><span>I consent to this identity verification step. <span className="required-mark" aria-hidden="true">*</span></span></label><div className="security-line"><LockKeyhole size={14}/> Physical verification occurs at the first blood-centre visit</div></>}
        {index===3&&<><div className="field-pair"><label className="field-valid"><RequiredWalkthroughLabel>Blood group</RequiredWalkthroughLabel><select required value={group} onChange={e=>{takeControl();setGroup(e.target.value);}}>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=><option key={g}>{g}</option>)}</select></label><label className="field-valid"><RequiredWalkthroughLabel>Donation invitations</RequiredWalkthroughLabel><select required value={component} onChange={e=>{takeControl();setComponent(e.target.value);}}>{["Whole blood","Platelet apheresis","Plasma apheresis"].map(g=><option key={g}>{g}</option>)}</select></label></div><div className="detail-row"><MapPin size={15}/>Lucknow, Uttar Pradesh</div><div className="detail-row"><CircleCheck size={15}/>One-time previous-donation declaration saved</div><div className="detail-row"><Bell size={15}/>Request and status notifications enabled</div></>}
        {index===4&&<><div className={`availability-row ${!available&&submitted?"field-invalid":""}`} data-field-group data-invalid={!available&&submitted}><div><strong>Open to requests <span className="required-mark" aria-hidden="true">*</span></strong><small>{available?"Potentially contactable":"Requests are paused"}</small></div><button aria-invalid={!available&&submitted} className={`toggle ${available?"on":""}`} role="switch" aria-label="Open to requests" aria-checked={available} onClick={()=>{touch("available");toggle(setAvailable,!available);}} type="button"><span/></button></div><div className="detail-row"><CircleCheck size={17}/>Connected records and initial declaration checked</div><div className="detail-row"><CircleCheck size={17}/>{component} invitations enabled</div><span className="subtle">Final eligibility requires hospital screening.</span></>}
        {(index===5||index===6)&&<><div className="request-heading"><span className="blood-type">{group}</span><div><span className="urgent">APPROVED URGENT REQUEST</span><strong>City Hospital</strong><small>{component} / 1 donor needed</small></div></div><div className="detail-row"><BadgeCheck size={16}/>Maker-checker approved / outreach policy passed</div>{index===6?<label className={`check-label ${validationClass(consent,consent,touched.has("consent"),submitted)}`}><input aria-invalid={!consent&&(touched.has("consent")||submitted)} type="checkbox" checked={consent} onChange={e=>{touch("consent");toggle(setConsent,e.target.checked);}} required/><span>Share my contact details with this hospital. <span className="required-mark" aria-hidden="true">*</span></span></label>:<div className="match-tags"><span>Group match</span><span>Approximate area</span><span>Contactable</span></div>}</>}
        {index===7&&<><div className="visit-ticket"><Hospital size={27}/><div><strong>City Hospital</strong><span>Blood donation centre / Ground floor</span></div><b>RS-2048</b></div><label className={`check-label ${validationClass(hospitalConfirmed,hospitalConfirmed,touched.has("hospitalConfirmed"),submitted)}`}><input aria-invalid={!hospitalConfirmed&&(touched.has("hospitalConfirmed")||submitted)} type="checkbox" checked={hospitalConfirmed} onChange={e=>{touch("hospitalConfirmed");toggle(setHospitalConfirmed,e.target.checked);}} required/><span>Hospital confirmed this donor should travel. <span className="required-mark" aria-hidden="true">*</span></span></label><div className="detail-row"><MapPin size={15}/>Reporting window: 2:30–3:15 PM</div></>}
        {index===8&&<><div className={`confirmation-row ${!hospitalConfirmed&&submitted?"field-invalid":""}`} data-field-group data-invalid={!hospitalConfirmed&&submitted}><Hospital size={20}/><div><strong>Visit and screening record <span className="required-mark" aria-hidden="true">*</span></strong><small>Identity, history and screening recorded</small></div><input aria-invalid={!hospitalConfirmed&&submitted} aria-label="Visit and screening record" type="checkbox" checked={hospitalConfirmed} onChange={e=>{touch("hospitalConfirmed");toggle(setHospitalConfirmed,e.target.checked);}} required/></div><div className={`confirmation-row ${!outcomeRecorded&&submitted?"field-invalid":""}`} data-field-group data-invalid={!outcomeRecorded&&submitted}><ShieldCheck size={20}/><div><strong>Authorized outcome <span className="required-mark" aria-hidden="true">*</span></strong><small>Completed, deferred or interrupted</small></div><input aria-invalid={!outcomeRecorded&&submitted} aria-label="Authorized outcome" type="checkbox" checked={outcomeRecorded} onChange={e=>{touch("outcomeRecorded");toggle(setOutcomeRecorded,e.target.checked);}} required/></div><span className="subtle">{Number(hospitalConfirmed)+Number(outcomeRecorded)} of 2 hospital records completed</span></>}
        {index===9&&<><div className="record-balance"><HeartPulse size={30}/><div><span>CONNECTED DONATION HISTORY</span><strong>{success?"1":"0"}<small> recorded</small></strong></div><span className="record-state">Closed</span></div><div className="detail-row"><Heart size={16}/>Donation history and contact interval updated</div><div className="detail-row"><Users size={16}/>Waiting donors automatically informed</div></>}
        <div className="action-area"><button className={`primary-action ${success?"success-action":""}`} onClick={success?()=>{setPlaying(false);if(index===9)replay();else jump(index+1);}:undefined} type={success?"button":"submit"}>{success?<><Check size={15}/>{index===9?"Replay journey":"Continue"}</>:<>{step.action}<ArrowRight size={15}/></>}</button><MousePointer2 className="demo-cursor" size={24} fill="#202b36"/>{index===6&&!success&&<button className="decline-action" onClick={()=>{takeControl();setDeclined(true);setError("Request declined. Your contact details remain private.");}} type="button">Decline</button>}</div><div className={`inline-feedback ${error?declined?"neutral-feedback":"error-feedback":success?"ok-feedback":""}`} role="status">{error||(success?step.result:step.note)}</div>
      </form><aside className="screen-aside">{index>=5&&index<=7?<><LocalMap/><div className="aside-caption"><Hospital size={15}/><span>City Hospital<strong>Verified blood centre</strong></span></div></>:<><div className={`visual-emblem ${success?"verified":""}`}>{index===9?<CircleCheck size={54}/>:index===2?<Fingerprint size={62}/>:index===8?<HeartPulse size={58}/>:<Droplet size={54} fill="currentColor"/>}<span className="emblem-check"><Check size={17}/></span></div><h3>{index===9?"The loop is safely closed.":index===8?"Every hospital record counts.":"Connected by care."}</h3><p>{index===9?"Request closed. Donors informed.":"A trusted connection between donors and hospitals."}</p><span className="secure-label"><ShieldCheck size={13}/>{success?"Step complete":"Private. Verified. Connected."}</span></>}</aside></div></div>
      <footer className="app-footer"><span><LockKeyhole size={10}/>Secure donor portal</span><span>Walkthrough</span></footer></div></div></div><div className="home-indicator"/></div><div className="device-under"><span><ShieldCheck size={14}/>Illustrative walkthrough. No real request is sent.</span><span>Explore safely</span></div></div>
      <aside className="story"><div className="story-copy"><span className="chapter">CHAPTER {String(index+1).padStart(2,"0")} <span>/ 10</span></span><h2>{step.title}</h2><p>{step.body}</p><div className="actor-label"><span className="actor-icon">{index===7?<Hospital size={17}/>:<UserRound size={17}/>}</span><div><small>WHO TAKES THIS STEP</small><strong>{step.actor}</strong></div></div></div><div className={`outcome ${success?"outcome-complete":""}`}><span>{success?<CircleCheck size={19}/>:<Signal size={19}/>}</span><div><small>{success?"RESULT":"HAPPENING NOW"}</small><p>{success?step.result:phase===0?"Opening the next part of the journey...":step.action+"..."}</p></div></div></aside>
    </section>
    <section className="playback" aria-label="Walkthrough controls"><div className="play-progress"/><div className="transport"><button className="play-button" title={playing?"Pause walkthrough":"Play walkthrough"} aria-label={playing?"Pause walkthrough":"Play walkthrough"} onClick={togglePlay}>{playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}</button><button title="Previous step" aria-label="Previous step" disabled={index===0} onClick={()=>jump(index-1)}><ChevronLeft size={21}/></button><button title="Next step" aria-label="Next step" disabled={index===9} onClick={()=>jump(index+1)}><ChevronRight size={21}/></button><button title="Replay journey" aria-label="Replay journey" onClick={replay}><RotateCcw size={17}/></button><span className="playback-title">{playing?"Playing the full journey":manual?"Explore at your own pace":"Paused"}<small>{String(index+1).padStart(2,"0")} / 10 <span>{step.label}</span></small></span></div><div className="playback-options"><label>Speed<select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.75}>0.75x</option><option value={1}>1x</option><option value={1.5}>1.5x</option><option value={2}>2x</option></select></label><button className="try-button" onClick={takeControl}><MousePointer2 size={16}/>Try it yourself</button></div></section>
    <section className="public-information" aria-label="Public information and support">
      <article id="privacy"><LockKeyhole size={18}/><div><strong>Privacy</strong><p>Donor details are used for account access, matching and hospital-controlled coordination. Donor identity is never displayed to other donors.</p></div></article>
      <article id="terms"><ShieldCheck size={18}/><div><strong>Terms of participation</strong><p>RaktSetu coordinates requests and responses. It never guarantees blood availability or declares a person medically eligible.</p></div></article>
      <article id="accessibility"><UserRound size={18}/><div><strong>Accessibility</strong><p>Keyboard navigation, reduced-motion support and readable status text are built into this experience. Additional language and assisted-access support will expand during rollout.</p></div></article>
      <article id="grievance"><Hospital size={18}/><div><strong>Grievance and contact</strong><p>Donor complaints and hospital operational issues will be routed to the participating blood centre and the designated RaktSetu grievance officer. Verified contact details will be published before the public pilot.</p><a id="contact" href="#help">Review the help journey</a></div></article>
    </section>
    <footer className="page-footer"><span>RaktSetu / A bridge between a donor and a life.</span><nav aria-label="Support links"><a href="#help">Help</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#accessibility">Accessibility</a><a href="#grievance">Grievance</a><a href="#contact">Contact</a></nav><button className="footer-start" onClick={onRegister} type="button">START YOUR DONOR ACCOUNT <ArrowRight size={12}/></button></footer>
  </main>;
}

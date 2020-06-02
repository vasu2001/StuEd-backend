const express = require("express");
const signinRouter = require("./routes/login-signup");
const commomRouter = require("./routes/common-ui");
const paymentRouter = require("./routes/payment");
const studentSlotRouter = require("./routes/student-slot");
const teacherSlotRouter = require("./routes/teacher-slot");
const userRouter = require("./routes/user");
const auth = require("./middlewares/auth");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
     res.send({ a: "Asfd" });
});

app.use("/", signinRouter);
app.use("/", commomRouter);
app.use("/", auth, paymentRouter);
app.use("/student/", auth, studentSlotRouter);
app.use("/teacher/", auth, teacherSlotRouter);
app.use("/user", auth, userRouter);

app.listen(3000, () => {
     console.log("Server up and running");
});

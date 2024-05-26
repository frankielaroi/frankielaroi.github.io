<?php

   $email = $_POST['email'];
   $subject = $_POST['subject'];
   $message = $_POST['message'];
   $yourEmail = "frankiekweku@gmail.com";

   $to = $yourEmail;
   $message = $message;
   $from = $email;
   $headers = "From:" . $email;
   mail($to,$subject,$message,$headers);
   echo "Mail Sent.";

?>